const { GoogleGenAI } = require('@google/genai');
const axios = require('axios');
const { getData, saveData } = require('../db');

// Provider Configuration
const AI_PROVIDER = (process.env.AI_PROVIDER || 'gemini').toLowerCase();
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3';
const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';

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
            
            // Retries only for Gemini 429s/503s or Ollama connection errors
            if ((status === 503 || status === 429 || err?.code === 'ECONNREFUSED') && retries < 2) {
                console.log(`[AI Queue] Request failed (Status/Code: ${status || err?.code}). Adding backoff and retrying...`);
                
                currentBackoff += 5000;
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
