/**
 * ESTIF HOME ULTIMATE - NLP SERVICE
 * Natural Language Processing for voice command understanding
 * Version: 2.0.0
 */

const natural = require('natural');
const tokenizer = new natural.WordTokenizer();
const stemmer = natural.PorterStemmer;
const TfIdf = natural.TfIdf;

class NLPService {
    constructor() {
        this.intents = this.initIntents();
        this.entityRecognizers = this.initEntityRecognizers();
        this.tfidf = new TfIdf();
        this.stopWords = ['a', 'an', 'the', 'and', 'or', 'but', 'so', 'for', 'nor', 'yet', 'to', 'of', 'in', 'on', 'at', 'by', 'with', 'without'];
    }

    initIntents() {
        return {
            device_on: {
                patterns: ['turn on', 'switch on', 'enable', 'activate', 'start', 'power on', 'light up', 'wake up'],
                confidence: 0
            },
            device_off: {
                patterns: ['turn off', 'switch off', 'disable', 'deactivate', 'stop', 'shut down', 'power off', 'kill'],
                confidence: 0
            },
            device_toggle: {
                patterns: ['toggle', 'flip', 'change', 'switch', 'reverse'],
                confidence: 0
            },
            master_on: {
                patterns: ['all on', 'everything on', 'turn on all', 'activate all', 'enable all', 'power all'],
                confidence: 0
            },
            master_off: {
                patterns: ['all off', 'everything off', 'turn off all', 'disable all', 'stop all', 'power off all'],
                confidence: 0
            },
            auto_mode_enable: {
                patterns: ['enable auto', 'activate auto', 'turn on auto', 'auto mode on', 'automatic mode', 'smart mode'],
                confidence: 0
            },
            auto_mode_disable: {
                patterns: ['disable auto', 'deactivate auto', 'turn off auto', 'auto mode off', 'manual mode', 'direct control'],
                confidence: 0
            },
            query_temperature: {
                patterns: ['what is the temperature', 'temperature', 'how hot', 'how cold', 'temp', 'current temperature', 'room temperature'],
                confidence: 0
            },
            query_humidity: {
                patterns: ['what is the humidity', 'humidity', 'how humid', 'moisture level', 'air moisture'],
                confidence: 0
            },
            query_energy: {
                patterns: ['energy usage', 'power consumption', 'how much power', 'electricity usage', 'energy report'],
                confidence: 0
            },
            set_temperature: {
                patterns: ['set temperature', 'change temperature', 'make it', 'degrees', 'set to', 'adjust temperature'],
                confidence: 0
            },
            schedule: {
                patterns: ['schedule', 'set timer', 'remind me to', 'every day at', 'daily at', 'weekly at', 'at'],
                confidence: 0
            },
            scene_activate: {
                patterns: ['activate scene', 'run scene', 'start scene', 'switch to', 'set mood to', 'mood'],
                confidence: 0
            },
            help: {
                patterns: ['help', 'what can I say', 'commands', 'voice commands', 'what do you do'],
                confidence: 0
            }
        };
    }

    initEntityRecognizers() {
        return {
            device: {
                patterns: ['light', 'fan', 'ac', 'tv', 'heater', 'pump', 'lamp', 'bulb', 'lighting', 'ceiling fan', 'air conditioner', 'television', 'radiator', 'water pump'],
                synonyms: {
                    'light': ['lamp', 'bulb', 'ceiling light', 'floor lamp', 'table lamp', 'chandelier'],
                    'fan': ['ceiling fan', 'exhaust fan', 'standing fan', 'tower fan', 'pedestal fan'],
                    'ac': ['air conditioner', 'aircon', 'cooling', 'hvac', 'climate control', 'ac unit'],
                    'tv': ['television', 'screen', 'display', 'television set', 'tv set', 'smart tv'],
                    'heater': ['radiator', 'warming', 'space heater', 'electric heater', 'central heating'],
                    'pump': ['water pump', 'sump pump', 'pool pump', 'circulation pump']
                }
            },
            number: {
                patterns: ['\\d+', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'twenty', 'thirty'],
                values: { 
                    'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5, 'six': 6, 'seven': 7, 'eight': 8, 'nine': 9, 'ten': 10,
                    'twenty': 20, 'thirty': 30, 'forty': 40, 'fifty': 50
                }
            },
            time: {
                patterns: ['\\d{1,2}:\\d{2}', '\\d{1,2}\\s*(am|pm)', 'morning', 'afternoon', 'evening', 'night', 'midnight', 'noon']
            },
            room: {
                patterns: ['living room', 'bedroom', 'kitchen', 'bathroom', 'dining room', 'office', 'garage', 'garden', 'hallway', 'basement', 'attic', 'balcony']
            },
            temperature: {
                patterns: ['\\d+\\s*degrees?', '\\d+\\s*°', '\\d+\\s*celsius', '\\d+\\s*fahrenheit', '\\d+\\s*c', '\\d+\\s*f']
            }
        };
    }

    parseCommand(text) {
        const normalized = this.normalizeText(text);
        const tokens = tokenizer.tokenize(normalized);
        const filteredTokens = this.removeStopWords(tokens);
        const intent = this.detectIntent(normalized, filteredTokens);
        const entities = this.extractEntities(normalized, tokens);
        
        return {
            intent,
            entities,
            confidence: this.calculateConfidence(intent, entities),
            originalText: text,
            normalizedText: normalized,
            tokens: filteredTokens
        };
    }

    normalizeText(text) {
        let normalized = text.toLowerCase().trim();
        normalized = normalized.replace(/[^\w\s]/g, '');
        normalized = normalized.replace(/\s+/g, ' ');
        normalized = normalized.replace(/please/gi, '');
        normalized = normalized.replace(/could you/gi, '');
        normalized = normalized.replace(/would you/gi, '');
        return normalized;
    }

    removeStopWords(tokens) {
        return tokens.filter(token => !this.stopWords.includes(token));
    }

    detectIntent(text, tokens) {
        const scores = {};
        
        for (const [intentName, intentData] of Object.entries(this.intents)) {
            let score = 0;
            let matchedPatterns = 0;
            
            for (const pattern of intentData.patterns) {
                if (text.includes(pattern)) {
                    score += 1;
                    matchedPatterns++;
                }
            }
            
            for (const token of tokens) {
                for (const pattern of intentData.patterns) {
                    if (pattern.includes(token) || token.includes(pattern)) {
                        score += 0.3;
                    }
                }
            }
            
            scores[intentName] = score / (intentData.patterns.length + matchedPatterns);
        }
        
        const bestIntent = Object.entries(scores).reduce((a, b) => a[1] > b[1] ? a : b, ['unknown', 0]);
        
        return {
            name: bestIntent[0],
            confidence: Math.min(bestIntent[1], 1),
            allScores: scores
        };
    }

    extractEntities(text, tokens) {
        const entities = {
            device: null,
            number: null,
            time: null,
            room: null,
            temperature: null
        };
        
        // Extract device
        for (const [entityType, recognizer] of Object.entries(this.entityRecognizers)) {
            if (entityType === 'device') {
                for (const pattern of recognizer.patterns) {
                    if (text.includes(pattern)) {
                        entities.device = pattern;
                        break;
                    }
                    for (const [key, synonyms] of Object.entries(recognizer.synonyms || {})) {
                        for (const synonym of synonyms) {
                            if (text.includes(synonym)) {
                                entities.device = key;
                                break;
                            }
                        }
                    }
                }
            }
        }
        
        // Extract number
        const numberMatch = text.match(/\d+/);
        if (numberMatch) {
            entities.number = parseInt(numberMatch[0]);
        } else {
            for (const [word, value] of Object.entries(this.entityRecognizers.number.values)) {
                if (text.includes(word)) {
                    entities.number = value;
                    break;
                }
            }
        }
        
        // Extract time
        const timeRegex = /(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i;
        const timeMatch = text.match(timeRegex);
        if (timeMatch) {
            let hour = parseInt(timeMatch[1]);
            const minute = timeMatch[2] ? parseInt(timeMatch[2]) : 0;
            const ampm = timeMatch[3]?.toLowerCase();
            
            if (ampm === 'pm' && hour < 12) hour += 12;
            if (ampm === 'am' && hour === 12) hour = 0;
            
            entities.time = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
        } else if (text.includes('morning')) {
            entities.time = '08:00';
        } else if (text.includes('afternoon')) {
            entities.time = '14:00';
        } else if (text.includes('evening')) {
            entities.time = '18:00';
        } else if (text.includes('night')) {
            entities.time = '21:00';
        }
        
        // Extract room
        for (const room of this.entityRecognizers.room.patterns) {
            if (text.includes(room)) {
                entities.room = room;
                break;
            }
        }
        
        // Extract temperature
        const tempRegex = /(\d+)\s*degrees?\s*(?:celsius|fahrenheit|c|f)?/i;
        const tempMatch = text.match(tempRegex);
        if (tempMatch) {
            entities.temperature = parseInt(tempMatch[1]);
        }
        
        return entities;
    }

    extractDeviceName(text, availableDevices) {
        const matchedDevices = [];
        
        for (const device of availableDevices) {
            let score = 0;
            
            if (text.includes(device.name.toLowerCase())) {
                score += 1;
            }
            if (device.nameAm && text.includes(device.nameAm.toLowerCase())) {
                score += 0.9;
            }
            
            const deviceTokens = device.name.toLowerCase().split(' ');
            for (const token of deviceTokens) {
                if (text.includes(token)) score += 0.3;
            }
            
            if (score > 0) matchedDevices.push({ device, score });
        }
        
        matchedDevices.sort((a, b) => b.score - a.score);
        return matchedDevices[0]?.device || null;
    }

    extractRoomName(text, availableRooms) {
        for (const room of availableRooms) {
            if (text.includes(room.name.toLowerCase())) {
                return room;
            }
            if (room.nameAm && text.includes(room.nameAm.toLowerCase())) {
                return room;
            }
        }
        return null;
    }

    parseScheduleCommand(text) {
        const schedule = {
            action: null,
            time: null,
            days: [],
            deviceId: null,
            repeat: null
        };
        
        // Extract time
        const timeMatch = text.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
        if (timeMatch) {
            let hour = parseInt(timeMatch[1]);
            const minute = timeMatch[2] ? parseInt(timeMatch[2]) : 0;
            const ampm = timeMatch[3]?.toLowerCase();
            
            if (ampm === 'pm' && hour < 12) hour += 12;
            if (ampm === 'am' && hour === 12) hour = 0;
            
            schedule.time = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
        }
        
        // Extract days
        const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
        for (let i = 0; i < days.length; i++) {
            if (text.includes(days[i])) {
                schedule.days.push(i);
            }
        }
        
        if (text.includes('weekday') || text.includes('week days') || text.includes('weekdays')) {
            schedule.days = [1, 2, 3, 4, 5];
            schedule.repeat = 'weekly';
        }
        if (text.includes('weekend')) {
            schedule.days = [0, 6];
            schedule.repeat = 'weekly';
        }
        if (text.includes('daily') || text.includes('every day')) {
            schedule.days = [0, 1, 2, 3, 4, 5, 6];
            schedule.repeat = 'daily';
        }
        if (text.includes('monthly')) {
            schedule.repeat = 'monthly';
        }
        
        // Extract action
        if ((text.includes('on') && !text.includes('turn on') && !text.includes('switch on')) || text.includes('enable')) {
            schedule.action = 'on';
        } else if (text.includes('off') || text.includes('disable')) {
            schedule.action = 'off';
        } else if (text.includes('toggle')) {
            schedule.action = 'toggle';
        }
        
        return schedule;
    }

    calculateConfidence(intent, entities) {
        let confidence = intent.confidence;
        
        if (entities.device) confidence += 0.2;
        if (entities.number) confidence += 0.1;
        if (entities.time) confidence += 0.1;
        if (entities.room) confidence += 0.1;
        if (entities.temperature) confidence += 0.1;
        
        return Math.min(confidence, 1);
    }

    getCommandSuggestion(partialText, availableCommands) {
        const suggestions = [];
        const normalized = this.normalizeText(partialText);
        
        for (const command of availableCommands) {
            const normalizedCmd = this.normalizeText(command);
            if (normalizedCmd.startsWith(normalized)) {
                suggestions.push(command);
            } else if (normalizedCmd.includes(normalized)) {
                suggestions.push(command);
            }
        }
        
        // Calculate similarity for remaining commands
        const remaining = availableCommands.filter(cmd => !suggestions.includes(cmd));
        for (const command of remaining) {
            const normalizedCmd = this.normalizeText(command);
            let similarity = 0;
            const cmdTokens = normalizedCmd.split(' ');
            const inputTokens = normalized.split(' ');
            
            for (const cmdToken of cmdTokens) {
                for (const inputToken of inputTokens) {
                    if (cmdToken === inputToken) similarity += 1;
                    else if (cmdToken.includes(inputToken) || inputToken.includes(cmdToken)) similarity += 0.5;
                }
            }
            
            similarity = similarity / Math.max(cmdTokens.length, inputTokens.length);
            if (similarity > 0.5) {
                suggestions.push(command);
            }
        }
        
        return suggestions.slice(0, 5);
    }

    isWakeWord(text, wakeWords) {
        const normalized = this.normalizeText(text);
        for (const wakeWord of wakeWords) {
            const normalizedWake = this.normalizeText(wakeWord);
            if (normalized.includes(normalizedWake)) {
                return true;
            }
        }
        return false;
    }

    extractWakeWord(text, wakeWords) {
        const normalized = this.normalizeText(text);
        for (const wakeWord of wakeWords) {
            const normalizedWake = this.normalizeText(wakeWord);
            if (normalized.includes(normalizedWake)) {
                return wakeWord;
            }
        }
        return null;
    }

    getCommandAfterWakeWord(text, wakeWords) {
        const normalized = this.normalizeText(text);
        for (const wakeWord of wakeWords) {
            const normalizedWake = this.normalizeText(wakeWord);
            const index = normalized.indexOf(normalizedWake);
            if (index !== -1) {
                let command = normalized.substring(index + normalizedWake.length).trim();
                command = command.replace(/^(please|can you|would you|could you|kindly)\s*/i, '');
                return command;
            }
        }
        return text;
    }

    classifyIntent(text, availableIntents) {
        const results = [];
        const normalized = this.normalizeText(text);
        
        for (const intent of availableIntents) {
            let score = 0;
            const intentTokens = intent.toLowerCase().split(' ');
            for (const token of intentTokens) {
                if (normalized.includes(token)) score += 1;
            }
            score = score / intentTokens.length;
            results.push({ intent, score });
        }
        
        results.sort((a, b) => b.score - a.score);
        return results.slice(0, 3);
    }

    extractAllEntities(text) {
        const entities = {};
        
        // Extract numbers
        const numbers = text.match(/\d+/g);
        if (numbers) entities.numbers = numbers.map(n => parseInt(n));
        
        // Extract percentages
        const percentages = text.match(/\d+%/g);
        if (percentages) entities.percentages = percentages.map(p => parseInt(p));
        
        // Extract currency
        const currency = text.match(/\$\d+(?:\.\d+)?/g);
        if (currency) entities.currency = currency;
        
        // Extract email
        const email = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g);
        if (email) entities.email = email;
        
        // Extract URL
        const url = text.match(/https?:\/\/[^\s]+/g);
        if (url) entities.url = url;
        
        return entities;
    }

    getSimilarity(text1, text2) {
        const normalized1 = this.normalizeText(text1);
        const normalized2 = this.normalizeText(text2);
        
        const tokens1 = new Set(tokenizer.tokenize(normalized1));
        const tokens2 = new Set(tokenizer.tokenize(normalized2));
        
        const intersection = new Set([...tokens1].filter(x => tokens2.has(x)));
        const union = new Set([...tokens1, ...tokens2]);
        
        return intersection.size / union.size;
    }

    tokenizeAndStem(text) {
        const tokens = tokenizer.tokenize(this.normalizeText(text));
        return tokens.map(token => stemmer.stem(token));
    }
}

module.exports = new NLPService();