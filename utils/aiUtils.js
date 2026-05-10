const { GoogleGenAI } = require('@google/genai');
const axios = require('axios');
const { getData, saveData } = require('../db');

// Provider Configuration
const AI_PROVIDER = (process.env.AI_PROVIDER || 'gemini').toLowerCase();
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3';
const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
const GROQ_API_KEY = process.env.GROQ_API_KEY || '';
const GROQ_API_URL = process.env.GROQ_API_URL || 'https://api.groq.com';
// Optional OpenRouter fallback/proxy
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || '';
const OPENROUTER_API_URL = process.env.OPENROUTER_API_URL || 'https://api.openrouter.ai';
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || 'inclusionai/ring-2.6-1t:free';
const GROQ_MODEL = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
// Debug info to confirm which provider and URL are used at runtime
console.log('[AI CONFIG] Provider=', AI_PROVIDER, 'GROQ_API_URL=', GROQ_API_URL, 'OPENROUTER=', OPENROUTER_API_URL, 'GROQ_MODEL=', GROQ_MODEL, 'OPENROUTER_MODEL=', OPENROUTER_MODEL);

// Gemini Models
const AI_PRIMARY_MODEL = 'gemini-2.5-flash-lite';
const AI_FALLBACK_MODEL = 'gemini-1.5-pro';
const DAILY_LIMIT = 1500;

// Rate limiting (Safe buffer for Gemini API free tier)
const BASE_QUEUE_INTERVAL = 4000; // 4 seconds between requests (15 RPM)
let currentBackoff = 0;
let isProcessing = false;
const requestQueue = [];

let genAI = null;

/**
 * Initialize AI once
 */
function getAI() {
    if (!genAI) {
        if (!process.env.GEMINI_API_KEY && AI_PROVIDER === 'gemini') {
            throw new Error('GEMINI_API_KEY is not set in environment variables');
        }
        genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || 'dummy' });
    }
    return genAI;
}

/**
 * Helper to call Groq API. Returns an object similar to Gemini's response shape ({ text })
 */
async function callGroq(prompt) {
    // Support OpenRouter as a proxy to Groq if OPENROUTER_API_KEY is provided
    const useOpenRouter = !!OPENROUTER_API_KEY;
    const apiKey = useOpenRouter ? OPENROUTER_API_KEY : GROQ_API_KEY;
    const baseUrl = useOpenRouter ? OPENROUTER_API_URL : GROQ_API_URL;
    if (!apiKey) throw new Error('GROQ_API_KEY or OPENROUTER_API_KEY must be set in environment variables');

    // Use OpenAI-compatible chat completions format for OpenRouter
    const endpoint = useOpenRouter 
        ? `${baseUrl}/api/v1/chat/completions`
        : `${baseUrl}/openai/v1/responses`;
    
    const body = useOpenRouter 
        ? {
            model: OPENROUTER_MODEL,
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.7
        }
        : {
            model: GROQ_MODEL,
            input: prompt
        };

    const resp = await axios.post(endpoint, body, {
        headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
        },
        timeout: 30000
    });

    // Parse response.output -> content -> output_text
    // For OpenRouter (chat completions): choices[0].message.content
    // For Groq (responses): output[0].content[0].text
    try {
        if (useOpenRouter && resp.data?.choices && Array.isArray(resp.data.choices) && resp.data.choices[0]?.message?.content) {
            return { text: resp.data.choices[0].message.content };
        }
        const output = resp.data?.output;
        if (Array.isArray(output) && output.length > 0) {
            const first = output[0];
            const contentArray = first.content || first['content'];
            if (Array.isArray(contentArray)) {
                // find first output_text
                for (const item of contentArray) {
                    if (item && item.type === 'output_text' && typeof item.text === 'string') {
                        return { text: item.text };
                    }
                }
                // fallback: join any text fields
                const texts = contentArray.map(c => c.text).filter(Boolean);
                if (texts.length) return { text: texts.join('\n') };
            }
            // older shape: output[0].content[0].text
            if (first.content && first.content[0] && first.content[0].text) {
                return { text: first.content[0].text };
            }
        }
    } catch (e) {
        // fall through
    }

    // final fallback: try to extract a string from resp.data if possible
    function extractFirstString(obj) {
        if (obj == null) return null;
        const blacklist = new Set(['text', 'json', 'image', 'output_text', 'ok', 'true', 'false']);
        if (typeof obj === 'string') {
            const s = obj.trim();
            if (!s) return null;
            const lower = s.toLowerCase();
            if (blacklist.has(lower)) return null; // avoid returning schema-type tokens
            return s;
        }
        if (typeof obj === 'number' || typeof obj === 'boolean') return String(obj);
        if (Array.isArray(obj)) {
            for (const item of obj) {
                const s = extractFirstString(item);
                if (s) return s;
            }
            return null;
        }
        if (typeof obj === 'object') {
            // prefer common fields that likely contain real text
            const preferred = ['output_text', 'text', 'message', 'body', 'content'];
            for (const key of preferred) {
                if (key in obj) {
                    const s = extractFirstString(obj[key]);
                    if (s) return s;
                }
            }
            // otherwise search values but prefer longer/multi-word strings
            for (const k of Object.keys(obj)) {
                const candidate = obj[k];
                const s = extractFirstString(candidate);
                if (!s) continue;
                // prefer strings with spaces or punctuation (likely sentences)
                if (s.length > 40 || /[\s,.!?]/.test(s)) return s;
            }
            // last resort: return any short string
            for (const k of Object.keys(obj)) {
                const s = extractFirstString(obj[k]);
                if (s) return s;
            }
        }
        return null;
    }

    const fallback = extractFirstString(resp.data);
    if (fallback) return { text: fallback };
    return { text: JSON.stringify(resp.data) };
}

/**
 * Check if daily quota is reached (Only applies to Gemini)
 */
function isQuotaExceeded() {
    if (AI_PROVIDER !== 'gemini') return false;
    const usageData = getData('ai_usage');
    const today = new Date().toISOString().split('T')[0];
    const usage = usageData[today] || 0;
    return usage >= DAILY_LIMIT;
}

/**
 * Increment daily usage
 */
function incrementUsage() {
    const usageData = getData('ai_usage');
    const today = new Date().toISOString().split('T')[0];
    usageData[today] = (usageData[today] || 0) + 1;
    saveData('ai_usage', usageData);
}

/**
 * Process the queue sequentially
 */
async function processQueue() {
    if (isProcessing || requestQueue.length === 0) return;
    isProcessing = true;

    while (requestQueue.length > 0) {
        const { requestOptions, resolve, reject, retries } = requestQueue.shift();

        try {
            // Log which provider and model will handle this request for easier debugging
            try {
                let modelForLog = AI_PRIMARY_MODEL;
                if (AI_PROVIDER === 'ollama') modelForLog = OLLAMA_MODEL;
                else if (AI_PROVIDER === 'groq') modelForLog = OPENROUTER_API_KEY ? OPENROUTER_MODEL : GROQ_MODEL;
                else if (AI_PROVIDER === 'openrouter') modelForLog = OPENROUTER_MODEL;
                console.log(`[AI Queue] Processing request (provider=${AI_PROVIDER}, model=${modelForLog}, retries=${retries})`);
            } catch (e) {}
            if (isQuotaExceeded()) {
                throw new Error('Daily AI quota exceeded');
            }

            let text = '';

            if (AI_PROVIDER === 'ollama') {
                // Call Local Ollama API
                const response = await axios.post(`${OLLAMA_BASE_URL}/api/generate`, {
                    model: OLLAMA_MODEL,
                    prompt: requestOptions.contents?.[0]?.parts?.[0]?.text || "Hello",
                    system: requestOptions.systemInstruction?.parts?.[0]?.text || "",
                    stream: false
                });
                text = response.data.response;
            } else if (AI_PROVIDER === 'groq') {
                // Call Groq API with graceful fallback to Gemini on network errors
                try {
                    const prompt = requestOptions.contents?.[0]?.parts?.[0]?.text || requestOptions.prompt || "Hello";
                    const groqResp = await callGroq(prompt);
                    text = groqResp.text;
                } catch (groqErr) {
                    console.error('Groq API Error:', groqErr);
                    // If Gemini creds exist, fallback to Gemini automatically
                    if (process.env.GEMINI_API_KEY) {
                        try {
                            const ai = getAI();
                            const result = await ai.models.generateContent({
                                ...requestOptions,
                                model: AI_PRIMARY_MODEL
                            });
                            text = result.text;
                        } catch (gemErr) {
                            throw groqErr; // surface original groq error if fallback fails
                        }
                    } else {
                        throw groqErr; // no fallback available
                    }
                }
            } else if (AI_PROVIDER === 'openrouter') {
                // Call OpenRouter API (uses callGroq which detects OPENROUTER_API_KEY)
                const prompt = requestOptions.contents?.[0]?.parts?.[0]?.text || requestOptions.prompt || "Hello";
                const openRouterResp = await callGroq(prompt);
                text = openRouterResp.text;
            } else {
                // Call Gemini API
                const ai = getAI();
                const result = await ai.models.generateContent({
                    ...requestOptions,
                    model: AI_PRIMARY_MODEL
                });
                text = result.text;
            }

            incrementUsage();
            currentBackoff = 0; // Reset backoff on success
            resolve({ text });
        } catch (err) {
            const status = err?.status || err?.code || (err?.message && err.message.includes('429') ? 429 : 0);
            
            // Retries for transient errors (429/503) or connection errors. Respect Retry-After header,
            // use exponential backoff with jitter, and increase retry attempts slightly.
            if ((status === 503 || status === 429 || err?.code === 'ECONNREFUSED') && retries < 3) {
                try {
                    const raHeader = err?.response?.headers?.['retry-after'] || err?.response?.headers?.['Retry-After'];
                    let baseWaitMs = 5000 * (retries + 1);
                    if (raHeader) {
                        const parsed = parseInt(String(raHeader), 10);
                        if (!isNaN(parsed) && parsed > 0) baseWaitMs = parsed * 1000;
                    }

                    // exponential increase and small random jitter
                    const jitter = Math.floor(Math.random() * 1000);
                    const nextWait = Math.min(60000, baseWaitMs * Math.pow(2, retries));
                    currentBackoff = Math.min(120000, (currentBackoff || 0) + nextWait + jitter);

                    console.log(`[AI Queue] Request failed (Status: ${status || err?.code}). Retrying in ${currentBackoff}ms (retry ${retries + 1}).`);
                    // helpful debug info from provider
                    if (err?.response?.data) console.debug('[AI Queue] Provider response data:', typeof err.response.data === 'string' ? err.response.data.substring(0,500) : err.response.data);
                } catch (be) {
                    console.warn('[AI Queue] Backoff calc error:', be);
                    currentBackoff += 5000;
                }

                requestQueue.unshift({ requestOptions, resolve, reject, retries: retries + 1 });
                await new Promise(r => setTimeout(r, currentBackoff));
            } else if (retries < 3 && AI_PROVIDER === 'gemini') {
                // Gemini Fallback logic
                try {
                    console.log(`[AI Queue] Attempting fallback to ${AI_FALLBACK_MODEL}`);
                    const ai = getAI();
                    const result = await ai.models.generateContent({
                        ...requestOptions,
                        model: AI_FALLBACK_MODEL
                    });
                    incrementUsage();
                    currentBackoff = 0;
                    resolve({ text: result.text });
                } catch (fallbackErr) {
                    reject(err);
                }
            } else {
                reject(err);
            }
        }

        if (requestQueue.length > 0) {
            // No forced interval for Ollama if desired, but keeping a small buffer for stability
            const waitTime = (AI_PROVIDER === 'ollama' ? 500 : BASE_QUEUE_INTERVAL) + currentBackoff;
            await new Promise(r => setTimeout(r, waitTime));
        }
    }

    isProcessing = false;
}

/**
 * Enqueue an AI call
 * @param {Object} requestOptions - Options for generateContent
 * @param {Boolean} priority - If true, jump to the front of the queue
 * @returns {Promise<Object>} - Response object with text
 */
function enqueueAICall(requestOptions, priority = false) {
    return new Promise((resolve, reject) => {
        const item = { requestOptions, resolve, reject, retries: 0 };
        if (priority) {
            requestQueue.unshift(item);
        } else {
            requestQueue.push(item);
        }
        processQueue();
    });
}

module.exports = {
    enqueueAICall,
    isQuotaExceeded,
    DAILY_LIMIT,
    AI_PRIMARY_MODEL,
    AI_FALLBACK_MODEL,
    AI_PROVIDER,
    OLLAMA_MODEL
};
