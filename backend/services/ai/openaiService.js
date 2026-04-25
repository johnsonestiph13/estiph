const OpenAI = require('openai');

class OpenAIService {
    constructor() {
        this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    }

    async processCommand(userId, text, deviceStates) {
        try {
            const completion = await this.openai.chat.completions.create({
                model: 'gpt-3.5-turbo',
                messages: [
                    { role: 'system', content: this.getSystemPrompt(deviceStates) },
                    { role: 'user', content: text }
                ],
                temperature: 0.3,
                max_tokens: 150
            });
            
            const response = completion.choices[0].message.content;
            return this.parseResponse(response);
        } catch (error) {
            console.error('OpenAI API Error:', error);
            return { action: 'error', message: 'AI service unavailable' };
        }
    }

    getSystemPrompt(devices) {
        return `You are a home automation assistant. Parse user commands into JSON actions.
        Devices: ${JSON.stringify(devices.map(d => ({ id: d.id, name: d.name, type: d.type })))}`;
    }

    parseResponse(response) {
        try {
            return JSON.parse(response);
        } catch {
            return { action: 'unknown', message: 'Could not parse command' };
        }
    }
}

module.exports = new OpenAIService();