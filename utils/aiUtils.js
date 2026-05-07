const { GoogleGenAI } = require('@google/genai');
const { getData, saveData } = require('../db');

// Models
const AI_PRIMARY_MODEL = 'gemini-2.5-flash';
const AI_FALLBACK_MODEL = 'gemini-2.5-flash-lite';
const DAILY_LIMIT = 1500;

// Rate limiting (Safe buffer for 15 RPM free tier)
const QUEUE_INTERVAL = 4500; // 4.5 seconds between requests
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
        genAI = new GoogleGenAI(process.env.GEMINI_API_KEY);
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
            resolve({ text });
        } catch (err) {
            const status = err?.status || err?.code || (err?.message && err.message.includes('429') ? 429 : 0);
            
            if ((status === 503 || status === 429) && retries < 2) {
                console.log(`[AI Queue] Rate limited or overloaded (Status: ${status}). Retrying...`);
                // Re-enqueue with incremented retry count
                requestQueue.unshift({ requestOptions, resolve, reject, retries: retries + 1 });
                // Wait longer if rate limited
                await new Promise(r => setTimeout(r, 2000 * (retries + 1)));
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
                    resolve({ text });
                } catch (fallbackErr) {
                    reject(err);
                }
            } else {
                reject(err);
            }
        }

        if (requestQueue.length > 0) {
            await new Promise(r => setTimeout(r, QUEUE_INTERVAL));
        }
    }

    isProcessing = false;
}

/**
 * Enqueue an AI call
 * @param {Object} requestOptions - Options for generateContent
 * @returns {Promise<Object>} - Response object with text
 */
function enqueueAICall(requestOptions) {
    return new Promise((resolve, reject) => {
        requestQueue.push({ requestOptions, resolve, reject, retries: 0 });
        processQueue();
    });
}

module.exports = {
    enqueueAICall,
    isQuotaExceeded,
    DAILY_LIMIT
};
