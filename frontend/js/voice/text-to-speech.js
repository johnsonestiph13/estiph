/**
 * ESTIF HOME ULTIMATE - TEXT TO SPEECH MODULE
 * Convert text to speech with multiple voices and language support
 * Version: 2.0.0
 * Author: Estifanos Yohannis
 */

// ============================================
// TTS CONFIGURATION
// ============================================

const TTSConfig = {
    // Default settings
    defaultVoice: null,
    defaultRate: 0.9,
    defaultPitch: 1.0,
    defaultVolume: 1.0,
    
    // Language voice mapping
    languageVoices: {
        'en': ['Google UK English Female', 'Google US English', 'Samantha', 'Alex'],
        'am': ['Google Amharic', 'Makeda', 'Selam'],
        'ar': ['Google Arabic', 'Majed', 'Mounir'],
        'fr': ['Google Français', 'Amélie', 'Thomas'],
        'es': ['Google Español', 'Monica', 'Jorge'],
        'de': ['Google Deutsch', 'Anna', 'David'],
        'zh': ['Google 普通话', 'Ting-Ting', 'Li-Li']
    },
    
    // Queue settings
    queueEnabled: true,
    maxQueueSize: 50,
    
    // Debug
    debug: false
};

// ============================================
// TEXT TO SPEECH MANAGER
// ============================================

class TextToSpeechManager {
    constructor() {
        this.synthesis = window.speechSynthesis;
        this.voices = [];
        self.currentUtterance = null;
        self.queue = [];
        self.isSpeaking = false;
        self.voiceMap = new Map();
        self.listeners = [];
        
        this.init();
    }

    init() {
        this.loadVoices();
        TTSConfig.debug && console.log('[TTS] Manager initialized');
    }

    loadVoices() {
        if (this.synthesis) {
            this.voices = this.synthesis.getVoices();
            this.buildVoiceMap();
            
            if (this.voices.length === 0) {
                this.synthesis.onvoiceschanged = () => {
                    this.voices = this.synthesis.getVoices();
                    this.buildVoiceMap();
                    this.notifyListeners('voices_loaded', this.voices);
                };
            } else {
                this.notifyListeners('voices_loaded', this.voices);
            }
        }
    }

    buildVoiceMap() {
        this.voiceMap.clear();
        
        for (const voice of this.voices) {
            const lang = voice.lang.split('-')[0];
            if (!this.voiceMap.has(lang)) {
                this.voiceMap.set(lang, []);
            }
            this.voiceMap.get(lang).push(voice);
        }
    }

    // ============================================
    // SPEECH METHODS
    // ============================================

    speak(text, options = {}) {
        if (!this.synthesis) {
            console.error('[TTS] Speech synthesis not supported');
            return false;
        }
        
        const utterance = new SpeechSynthesisUtterance(text);
        
        // Apply options
        utterance.rate = options.rate || TTSConfig.defaultRate;
        utterance.pitch = options.pitch || TTSConfig.defaultPitch;
        utterance.volume = options.volume || TTSConfig.defaultVolume;
        
        // Set voice
        if (options.voice) {
            utterance.voice = options.voice;
        } else if (options.lang) {
            const voice = this.getBestVoiceForLanguage(options.lang);
            if (voice) utterance.voice = voice;
        }
        
        // Set language
        utterance.lang = options.lang || 'en-US';
        
        // Set up event handlers
        utterance.onstart = () => {
            this.isSpeaking = true;
            this.notifyListeners('start', { text, utterance });
        };
        
        utterance.onend = () => {
            this.isSpeaking = false;
            this.notifyListeners('end', { text, utterance });
            this.processQueue();
        };
        
        utterance.onerror = (event) => {
            console.error('[TTS] Error:', event);
            this.isSpeaking = false;
            this.notifyListeners('error', { error: event, text });
            this.processQueue();
        };
        
        utterance.onboundary = (event) => {
            this.notifyListeners('boundary', event);
        };
        
        // Add to queue or speak immediately
        if (TTSConfig.queueEnabled && this.isSpeaking) {
            this.queue.push({ text, options, utterance });
            this.notifyListeners('queued', { text, queueSize: this.queue.length });
            return true;
        }
        
        this.currentUtterance = utterance;
        this.synthesis.speak(utterance);
        return true;
    }

    stop() {
        if (this.synthesis) {
            this.synthesis.cancel();
            this.isSpeaking = false;
            this.currentUtterance = null;
            this.queue = [];
            this.notifyListeners('stopped');
        }
    }

    pause() {
        if (this.synthesis && this.isSpeaking) {
            this.synthesis.pause();
            this.notifyListeners('paused');
        }
    }

    resume() {
        if (this.synthesis && !this.isSpeaking) {
            this.synthesis.resume();
            this.notifyListeners('resumed');
        }
    }

    processQueue() {
        if (this.queue.length > 0 && !this.isSpeaking) {
            const next = this.queue.shift();
            this.speak(next.text, next.options);
            this.notifyListeners('queue_processed', { remaining: this.queue.length });
        }
    }

    // ============================================
    // VOICE MANAGEMENT
    // ============================================

    getVoices() {
        return this.voices;
    }

    getVoicesForLanguage(lang) {
        const langCode = lang.split('-')[0];
        return this.voiceMap.get(langCode) || [];
    }

    getBestVoiceForLanguage(lang, gender = null) {
        const voices = this.getVoicesForLanguage(lang);
        
        if (voices.length === 0) return null;
        
        // Try to find a voice that matches gender preference
        if (gender) {
            const genderMatch = voices.find(v => 
                v.name.toLowerCase().includes(gender.toLowerCase())
            );
            if (genderMatch) return genderMatch;
        }
        
        // Return first available voice for the language
        return voices[0];
    }

    getDefaultVoice() {
        if (TTSConfig.defaultVoice) {
            return this.voices.find(v => v.name === TTSConfig.defaultVoice);
        }
        return this.voices.find(v => v.default) || this.voices[0];
    }

    // ============================================
    // UTILITY METHODS
    // ============================================

    isSupported() {
        return !!this.synthesis;
    }

    getQueueSize() {
        return this.queue.length;
    }

    clearQueue() {
        this.queue = [];
        this.notifyListeners('queue_cleared');
    }

    // ============================================
    // EVENT SYSTEM
    // ============================================

    addEventListener(event, callback) {
        this.listeners.push({ event, callback });
        return () => {
            const index = this.listeners.findIndex(l => l.event === event && l.callback === callback);
            if (index !== -1) this.listeners.splice(index, 1);
        };
    }

    notifyListeners(event, data) {
        this.listeners.forEach(listener => {
            if (listener.event === event) {
                listener.callback(data);
            }
        });
    }
}

// ============================================
// CREATE SINGLETON INSTANCE
// ============================================

const tts = new TextToSpeechManager();

// Expose globally
window.tts = tts;

export { tts, TextToSpeechManager, TTSConfig };