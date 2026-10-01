import express from 'express';

const app = express();
app.use(express.json());

// Token Bucket for API Keys (Simulating the dynamic gateway)
const API_KEYS = ['GROQ_KEY_1', 'GROQ_KEY_2', 'GROQ_KEY_3', 'GROQ_KEY_4'];
let currentKeyIndex = 0;

function getNextKey() {
    const key = API_KEYS[currentKeyIndex];
    currentKeyIndex = (currentKeyIndex + 1) % API_KEYS.length;
    return key;
}

// Language-Dependent TTS Routing Logic
function routeTTS(text: string, language: string) {
    if (language === 'ar') {
        console.log('[ROUTING] Arabic detected. Routing to Premium TTS for high dialect fidelity.');
        return { provider: 'Premium_TTS', cost: 'Premium' };
    } else {
        console.log('[ROUTING] English detected. Routing to Edge TTS (Zero-Cost).');
        return { provider: 'Edge_TTS', cost: 'Zero' };
    }
}

app.post('/api/voice-chat', async (req, res) => {
    try {
        const { text, language } = req.body;
        
        // 1. Load Balancing: Get available key from the pool
        const apiKey = getNextKey();
        
        // 2. STT & LLM Inference 
        // (Simulated 650ms delay representing Groq Llama 3.1 70B p50 latency)
        const llmProcessingTime = 650; 
        await new Promise(resolve => setTimeout(resolve, llmProcessingTime));
        
        // 3. Language-Dependent TTS Routing
        const ttsDecision = routeTTS(text, language);
        
        res.status(200).json({
            status: 'success',
            llm_latency_ms: llmProcessingTime,
            tts_routing: ttsDecision
        });
    } catch (error) {
        // 4. Graceful Fallback Mechanism (Triggered on complete pool exhaustion)
        res.status(503).json({
            status: 'fallback',
            message: 'Primary API pool exhausted. Falling back to localized cache.',
            audio_url: '/cache/fallback-audio.mp3'
        });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Voice API Gateway PoC running on port ${PORT}`));
