const { GoogleGenAI } = require('@google/genai');
const { getData, saveData } = require('../db');

// Models
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
        if (!process.env.GEMINI_API_KEY) {
            throw new Error('GEMINI_API_KEY is not set in environment variables');
        }
        genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    }
    return genAI;
}

/**
 * Check if daily quota is reached
 */
function isQuotaExceeded() {
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

            const ai = getAI();
            
            const result = await ai.models.generateContent({
                ...requestOptions,
                model: AI_PRIMARY_MODEL
            });
            const text = result.text;

            incrementUsage();
            currentBackoff = 0; // Reset backoff on success
            resolve({ text });
        } catch (err) {
            const status = err?.status || err?.code || (err?.message && err.message.includes('429') ? 429 : 0);
            
            if ((status === 503 || status === 429) && retries < 2) {
                console.log(`[AI Queue] Rate limited (Status: ${status}). Adding backoff and retrying...`);
                
                // Increase backoff by 5 seconds on each 429
                currentBackoff += 5000;
                
                // Re-enqueue with incremented retry count
                requestQueue.unshift({ requestOptions, resolve, reject, retries: retries + 1 });
                
                // Immediate wait for backoff
                await new Promise(r => setTimeout(r, currentBackoff));
            } else if (retries < 3) {
                // Try fallback model once
                try {
                    console.log(`[AI Queue] Attempting fallback to ${AI_FALLBACK_MODEL}`);
                    const ai = getAI();
                    const result = await ai.models.generateContent({
                        ...requestOptions,
                        model: AI_FALLBACK_MODEL
                    });
                    const text = result.text;
                    incrementUsage();
                    currentBackoff = 0;
                    resolve({ text });
                } catch (fallbackErr) {
                    reject(err);
                }
            } else {
                reject(err);
            }
        }

        if (requestQueue.length > 0) {
            const waitTime = BASE_QUEUE_INTERVAL + currentBackoff;
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
    AI_FALLBACK_MODEL
};
