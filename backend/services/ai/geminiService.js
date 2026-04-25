/**
 * ESTIF HOME ULTIMATE - GEMINI AI SERVICE
 * Google Gemini AI integration for voice command processing, recommendations, and automation
 * Version: 2.0.0
 * Author: Estifanos Yohannis
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');

class GeminiService {
    constructor() {
        this.genAI = null;
        this.model = null;
        this.conversationHistory = new Map();
        this.userPreferences = new Map();
        this.isInitialized = false;
        
        this.init();
    }

    init() {
        if (process.env.GEMINI_API_KEY) {
            this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
            this.model = this.genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
            this.isInitialized = true;
            console.log('✅ Gemini AI service initialized');
        } else {
            console.warn('⚠️ Gemini API key not configured, AI features disabled');
        }
    }

    /**
     * Process voice command with context awareness
     */
    async processCommand(userId, text, deviceStates, language = 'en') {
        if (!this.isInitialized) {
            return { action: 'error', message: 'AI service not configured' };
        }

        try {
            const context = this.getConversationContext(userId);
            const userPrefs = this.getUserPreferences(userId);
            const prompt = this.buildCommandPrompt(text, deviceStates, language, userPrefs);
            
            const result = await this.model.generateContent(prompt);
            const response = await result.response;
            const responseText = response.text();
            
            const action = this.parseResponse(responseText);
            this.updateConversationContext(userId, text, responseText);
            
            return action;
        } catch (error) {
            console.error('Gemini API Error:', error);
            return { 
                action: 'error', 
                message: 'AI service temporarily unavailable',
                fallback: this.processCommandFallback(text, deviceStates)
            };
        }
    }

    /**
     * Build system prompt with current device states
     */
    buildCommandPrompt(text, devices, language, preferences) {
        const deviceList = devices.map(d => 
            `- ${d.name} (id: ${d.id}, type: ${d.type}, state: ${d.state ? 'ON' : 'OFF'}, autoMode: ${d.autoMode}, power: ${d.power}W, room: ${d.room || 'Unknown'})`
        ).join('\n');

        const timeOfDay = this.getTimeOfDay();
        const date = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

        return `You are Estif Home, an advanced home automation assistant for a smart home system.

CURRENT CONTEXT:
- Date & Time: ${date}, ${timeOfDay}
- User Preferences: ${JSON.stringify(preferences)}
- Language: ${language === 'am' ? 'Amharic - respond in Amharic' : 'English'}

AVAILABLE DEVICES:
${deviceList}

AVAILABLE COMMANDS:
1. Device Control:
   - Turn device ON: {"action":"toggle","deviceId":<id>,"state":true}
   - Turn device OFF: {"action":"toggle","deviceId":<id>,"state":false}
   - Toggle device: {"action":"toggle","deviceId":<id>}

2. Master Control:
   - Turn everything ON: {"action":"master","state":true}
   - Turn everything OFF: {"action":"master","state":false}

3. Auto Mode:
   - Enable auto mode: {"action":"auto_mode","deviceId":<id>,"enabled":true}
   - Disable auto mode: {"action":"auto_mode","deviceId":<id>,"enabled":false}

4. Query information:
   - Temperature: {"action":"query","message":"Current temperature is X°C"}
   - Humidity: {"action":"query","message":"Current humidity is X%"}
   - Device status: {"action":"query","message":"Device is currently ON/OFF"}
   - Energy usage: {"action":"query","message":"Current energy usage is X kWh"}

5. Scene activation:
   - Activate scene: {"action":"scene","sceneName":"morning"}
   - Available scenes: morning, night, cinema, party, away, reading

6. Scheduling:
   - Create schedule: {"action":"schedule","deviceId":<id>,"time":"HH:MM","action":"on/off","days":[0-6]}

User command: "${text}"

RESPOND WITH ONLY VALID JSON. Do not add any extra text, explanations, or markdown formatting.

Examples:
- "turn on the living room light" → {"action":"toggle","deviceId":0,"state":true}
- "what's the temperature?" → {"action":"query","message":"The current temperature is 23°C"}
- "enable auto mode for ac" → {"action":"auto_mode","deviceId":2,"enabled":true}
- "turn off everything" → {"action":"master","state":false}
- "activate cinema mode" → {"action":"scene","sceneName":"cinema"}
- "schedule light to turn on at 6:30 AM every weekday" → {"action":"schedule","deviceId":0,"time":"06:30","action":"on","days":[1,2,3,4,5]}

Respond with JSON only:`;
    }

    /**
     * Parse Gemini response to extract JSON
     */
    parseResponse(responseText) {
        try {
            let jsonMatch = responseText.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                return JSON.parse(jsonMatch[0]);
            }
            
            const cleanText = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '');
            jsonMatch = cleanText.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                return JSON.parse(jsonMatch[0]);
            }
            
            return { action: 'unknown', message: 'Could not understand command' };
        } catch (e) {
            console.error('Parse error:', e);
            return { action: 'error', message: 'Failed to process command' };
        }
    }

    /**
     * Fallback command processing when AI is unavailable
     */
    processCommandFallback(text, devices) {
        const lowerText = text.toLowerCase();
        
        // Check for master commands
        if (lowerText.includes('all on') || lowerText.includes('everything on')) {
            return { action: 'master', state: true };
        }
        if (lowerText.includes('all off') || lowerText.includes('everything off')) {
            return { action: 'master', state: false };
        }
        
        // Check for temperature query
        if (lowerText.includes('temperature') || lowerText.includes('temp')) {
            return { action: 'query', message: 'Temperature information requested' };
        }
        
        // Check for device commands
        for (const device of devices) {
            if (lowerText.includes(device.name.toLowerCase())) {
                if (lowerText.includes('on')) {
                    return { action: 'toggle', deviceId: device.id, state: true };
                }
                if (lowerText.includes('off')) {
                    return { action: 'toggle', deviceId: device.id, state: false };
                }
                if (lowerText.includes('toggle')) {
                    return { action: 'toggle', deviceId: device.id };
                }
            }
        }
        
        return { action: 'unknown', message: 'Command not recognized' };
    }

    /**
     * Get time of day for context
     */
    getTimeOfDay() {
        const hour = new Date().getHours();
        if (hour < 12) return 'morning';
        if (hour < 17) return 'afternoon';
        if (hour < 21) return 'evening';
        return 'night';
    }

    /**
     * Get conversation context for user
     */
    getConversationContext(userId) {
        if (!this.conversationHistory.has(userId)) {
            this.conversationHistory.set(userId, []);
        }
        return this.conversationHistory.get(userId);
    }

    /**
     * Update conversation history
     */
    updateConversationContext(userId, userMessage, assistantResponse) {
        const context = this.getConversationContext(userId);
        context.push({ 
            role: 'user', 
            content: userMessage, 
            timestamp: Date.now(),
            type: 'command'
        });
        context.push({ 
            role: 'assistant', 
            content: assistantResponse, 
            timestamp: Date.now(),
            type: 'response'
        });
        
        while (context.length > 20) {
            context.shift();
        }
    }

    /**
     * Get user preferences
     */
    getUserPreferences(userId) {
        if (!this.userPreferences.has(userId)) {
            this.userPreferences.set(userId, {
                language: 'en',
                temperatureUnit: 'celsius',
                energyUnit: 'kwh',
                favoriteDevices: [],
                voiceSpeed: 'normal',
                notificationPreferences: {
                    onCommand: true,
                    onError: true
                }
            });
        }
        return this.userPreferences.get(userId);
    }

    /**
     * Update user preferences
     */
    updateUserPreferences(userId, preferences) {
        const current = this.getUserPreferences(userId);
        this.userPreferences.set(userId, { ...current, ...preferences });
    }

    /**
     * Process natural language schedule creation
     */
    async processScheduleCommand(text, deviceStates) {
        if (!this.isInitialized) {
            return null;
        }

        const prompt = `Parse the following schedule command and return JSON.
Command: "${text}"
Return format: {"deviceId":<id>,"time":"HH:MM","action":"on/off","days":[0-6],"enabled":true}
Days: 0=Sunday, 1=Monday, 2=Tuesday, 3=Wednesday, 4=Thursday, 5=Friday, 6=Saturday
Respond with ONLY valid JSON.`;

        try {
            const result = await this.model.generateContent(prompt);
            const response = await result.response;
            return this.parseResponse(response.text());
        } catch (error) {
            console.error('Schedule parsing error:', error);
            return null;
        }
    }

    /**
     * Generate energy saving recommendations
     */
    async getEnergyRecommendations(deviceStates, energyData) {
        if (!this.isInitialized) {
            return this.getFallbackRecommendations(deviceStates);
        }

        const deviceSummary = deviceStates.map(d => ({
            name: d.name,
            type: d.type,
            power: d.power,
            state: d.state,
            autoMode: d.autoMode,
            dailyEnergy: energyData.filter(e => e.deviceId === d.id).reduce((s, e) => s + e.energy, 0)
        }));

        const prompt = `Based on the following device usage data, provide 3 energy saving recommendations.
Data: ${JSON.stringify(deviceSummary)}
Return JSON array: [{"title":"...","description":"...","potentialSavings":"...","priority":"high/medium/low"}]
Respond with ONLY valid JSON.`;

        try {
            const result = await this.model.generateContent(prompt);
            const response = await result.response;
            const recommendations = this.parseResponse(response.text());
            return Array.isArray(recommendations) ? recommendations : [];
        } catch (error) {
            console.error('Recommendation error:', error);
            return this.getFallbackRecommendations(deviceStates);
        }
    }

    /**
     * Fallback recommendations when AI unavailable
     */
    getFallbackRecommendations(devices) {
        const recommendations = [];
        
        const devicesWithoutAuto = devices.filter(d => !d.autoMode && d.state);
        if (devicesWithoutAuto.length > 0) {
            recommendations.push({
                title: 'Enable Auto Mode',
                description: `${devicesWithoutAuto.length} devices are in manual mode`,
                potentialSavings: '15-25%',
                priority: 'medium'
            });
        }
        
        const highPowerDevices = devices.filter(d => d.power > 100 && d.state);
        if (highPowerDevices.length > 0) {
            recommendations.push({
                title: 'Monitor High-Power Devices',
                description: `${highPowerDevices.map(d => d.name).join(', ')} are consuming significant power`,
                potentialSavings: '10-20%',
                priority: 'high'
            });
        }
        
        return recommendations;
    }

    /**
     * Analyze device usage patterns
     */
    async analyzePatterns(deviceHistory) {
        if (!this.isInitialized || deviceHistory.length < 10) {
            return null;
        }

        const summary = {
            totalEvents: deviceHistory.length,
            uniqueDevices: [...new Set(deviceHistory.map(h => h.deviceId))].length,
            timeRange: {
                start: deviceHistory[0]?.timestamp,
                end: deviceHistory[deviceHistory.length - 1]?.timestamp
            }
        };

        const prompt = `Analyze these device usage patterns and identify insights.
Data: ${JSON.stringify(deviceHistory.slice(-50))}
Summary: ${JSON.stringify(summary)}
Return JSON: {"patterns":[],"insights":[],"anomalies":[]}
Respond with ONLY valid JSON.`;

        try {
            const result = await this.model.generateContent(prompt);
            const response = await result.response;
            return this.parseResponse(response.text());
        } catch (error) {
            console.error('Pattern analysis error:', error);
            return null;
        }
    }

    /**
     * Generate smart home insights
     */
    async generateInsights(deviceStates, energyData, userActivity) {
        if (!this.isInitialized) {
            return this.getFallbackInsights();
        }

        const prompt = `Based on the following smart home data, generate 3 actionable insights.
Devices: ${JSON.stringify(deviceStates.map(d => ({ name: d.name, state: d.state, autoMode: d.autoMode })))}
Energy: ${JSON.stringify(energyData.slice(-7))}
Return JSON array: [{"type":"info/warning/success","title":"...","description":"...","action":"..."}]
Respond with ONLY valid JSON.`;

        try {
            const result = await this.model.generateContent(prompt);
            const response = await result.response;
            const insights = this.parseResponse(response.text());
            return Array.isArray(insights) ? insights : [];
        } catch (error) {
            console.error('Insights generation error:', error);
            return this.getFallbackInsights();
        }
    }

    /**
     * Fallback insights
     */
    getFallbackInsights() {
        return [
            {
                type: 'info',
                title: 'Energy Monitoring Active',
                description: 'Continue monitoring your energy usage for personalized insights',
                action: 'View Analytics'
            },
            {
                type: 'success',
                title: 'Smart Home Ready',
                description: 'Your smart home system is fully operational',
                action: 'Explore Features'
            }
        ];
    }

    /**
     * Process multi-step conversation
     */
    async processConversation(userId, userMessage, deviceStates, conversationState = null) {
        if (!this.isInitialized) {
            return { response: "AI service not available", action: null };
        }

        const context = this.getConversationContext(userId);
        const state = conversationState || { step: 'initial', data: {} };
        
        const prompt = `You are having a conversation with a user about their smart home.
Current conversation step: ${state.step}
Previous context: ${JSON.stringify(context.slice(-5))}
User message: "${userMessage}"
Current device states: ${JSON.stringify(deviceStates.map(d => ({ name: d.name, state: d.state })))}

Determine the next step and response.
Return JSON: {"response":"your response","action":null,"nextStep":"next_step","data":{}}
Respond with ONLY valid JSON.`;

        try {
            const result = await this.model.generateContent(prompt);
            const response = await result.response;
            const parsed = this.parseResponse(response.text());
            
            this.updateConversationContext(userId, userMessage, parsed.response);
            
            return parsed;
        } catch (error) {
            console.error('Conversation error:', error);
            return {
                response: "I'm having trouble understanding. Can you rephrase?",
                action: null,
                nextStep: 'error',
                data: {}
            };
        }
    }

    /**
     * Check if AI service is available
     */
    isAvailable() {
        return this.isInitialized;
    }

    /**
     * Clear conversation history for a user
     */
    clearConversationHistory(userId) {
        this.conversationHistory.delete(userId);
    }

    /**
     * Clear all conversation histories
     */
    clearAllHistories() {
        this.conversationHistory.clear();
        this.userPreferences.clear();
    }

    /**
     * Get service status
     */
    getStatus() {
        return {
            initialized: this.isInitialized,
            apiKeyConfigured: !!process.env.GEMINI_API_KEY,
            activeConversations: this.conversationHistory.size,
            model: this.model ? 'gemini-1.5-flash' : null
        };
    }
}

module.exports = new GeminiService();