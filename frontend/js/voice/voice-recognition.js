/**
 * ESTIF HOME ULTIMATE - VOICE RECOGNITION MODULE
 * Speech recognition with multiple language support and real-time transcription
 * Version: 2.0.0
 * Author: Estifanos Yohannis
 */

// ============================================
// VOICE RECOGNITION CONFIGURATION
// ============================================

const VoiceRecognitionConfig = {
    // Recognition settings
    continuous: true,
    interimResults: true,
    maxAlternatives: 3,
    
    // Language settings
    defaultLanguage: 'en-US',
    supportedLanguages: ['en-US', 'en-GB', 'am-ET', 'ar-EG', 'fr-FR', 'es-ES', 'de-DE', 'zh-CN'],
    
    // Timeout settings
    silenceTimeout: 2000,
    recognitionTimeout: 60000,
    
    // Confidence threshold
    minConfidence: 0.6,
    
    // Storage
    storageKey: 'estif_voice_settings',
    
    // Debug
    debug: false
};

// ============================================
// VOICE RECOGNITION MANAGER
// ============================================

class VoiceRecognitionManager {
    constructor() {
        this.recognition = null;
        this.isListening = false;
        self.results = [];
        self.audioContext = null;
        self.mediaStream = null;
        self.listeners = [];
        self.settings = this.loadSettings();
        
        this.init();
    }

    init() {
        this.checkSupport();
        this.initRecognition();
        VoiceRecognitionConfig.debug && console.log('[VoiceRecognition] Manager initialized');
    }

    checkSupport() {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        this.isSupported = !!SpeechRecognition;
        
        if (!this.isSupported) {
            console.warn('[VoiceRecognition] Speech recognition not supported');
        }
        
        return this.isSupported;
    }

    initRecognition() {
        if (!this.isSupported) return;
        
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        this.recognition = new SpeechRecognition();
        
        this.recognition.continuous = VoiceRecognitionConfig.continuous;
        this.recognition.interimResults = VoiceRecognitionConfig.interimResults;
        this.recognition.maxAlternatives = VoiceRecognitionConfig.maxAlternatives;
        this.recognition.lang = this.settings.language || VoiceRecognitionConfig.defaultLanguage;
        
        this.setupEventHandlers();
    }

    setupEventHandlers() {
        this.recognition.onstart = () => {
            this.isListening = true;
            this.notifyListeners('start', { timestamp: Date.now() });
            VoiceRecognitionConfig.debug && console.log('[VoiceRecognition] Started');
        };
        
        this.recognition.onend = () => {
            this.isListening = false;
            this.notifyListeners('end', { timestamp: Date.now() });
            VoiceRecognitionConfig.debug && console.log('[VoiceRecognition] Ended');
        };
        
        this.recognition.onerror = (event) => {
            this.notifyListeners('error', { error: event.error });
            console.error('[VoiceRecognition] Error:', event.error);
            
            // Auto-restart on certain errors
            if (event.error === 'no-speech' && this.settings.autoRestart) {
                setTimeout(() => this.start(), 1000);
            }
        };
        
        this.recognition.onresult = (event) => {
            this.processResults(event);
        };
        
        this.recognition.onaudiostart = () => {
            this.notifyListeners('audio_start', { timestamp: Date.now() });
        };
        
        this.recognition.onaudioend = () => {
            this.notifyListeners('audio_end', { timestamp: Date.now() });
        };
        
        this.recognition.onsoundstart = () => {
            this.notifyListeners('sound_start', { timestamp: Date.now() });
        };
        
        this.recognition.onsoundend = () => {
            this.notifyListeners('sound_end', { timestamp: Date.now() });
        };
        
        this.recognition.onspeechstart = () => {
            this.notifyListeners('speech_start', { timestamp: Date.now() });
        };
        
        this.recognition.onspeechend = () => {
            this.notifyListeners('speech_end', { timestamp: Date.now() });
        };
    }

    processResults(event) {
        const results = [];
        
        for (let i = event.resultIndex; i < event.results.length; i++) {
            const result = event.results[i];
            const alternatives = [];
            
            for (let j = 0; j < result.length; j++) {
                const alternative = result[j];
                alternatives.push({
                    transcript: alternative.transcript,
                    confidence: alternative.confidence
                });
            }
            
            results.push({
                isFinal: result.isFinal,
                alternatives: alternatives,
                timestamp: Date.now()
            });
        }
        
        this.results.push(...results);
        
        // Keep only last 100 results
        if (this.results.length > 100) {
            this.results = this.results.slice(-100);
        }
        
        // Notify listeners
        const finalResults = results.filter(r => r.isFinal);
        const interimResults = results.filter(r => !r.isFinal);
        
        if (finalResults.length > 0) {
            this.notifyListeners('final_result', finalResults);
        }
        
        if (interimResults.length > 0) {
            this.notifyListeners('interim_result', interimResults);
        }
        
        // Get best transcript
        const bestResult = this.getBestResult();
        if (bestResult) {
            this.notifyListeners('transcript', {
                text: bestResult.transcript,
                confidence: bestResult.confidence,
                isFinal: results[results.length - 1]?.isFinal
            });
        }
    }

    // ============================================
    // PUBLIC METHODS
    // ============================================

    start(options = {}) {
        if (!this.isSupported) {
            throw new Error('Speech recognition not supported');
        }
        
        if (this.isListening) {
            this.stop();
        }
        
        if (options.language) {
            this.setLanguage(options.language);
        }
        
        try {
            this.recognition.start();
            return true;
        } catch (error) {
            console.error('[VoiceRecognition] Start failed:', error);
            
            // Restart recognition if it's already running
            if (error.message === 'start() called when already starting') {
                setTimeout(() => this.start(options), 100);
            }
            
            return false;
        }
    }

    stop() {
        if (!this.isSupported || !this.isListening) return;
        
        try {
            this.recognition.stop();
        } catch (error) {
            console.error('[VoiceRecognition] Stop failed:', error);
        }
    }

    abort() {
        if (!this.isSupported) return;
        
        try {
            this.recognition.abort();
        } catch (error) {
            console.error('[VoiceRecognition] Abort failed:', error);
        }
    }

    // ============================================
    // CONFIGURATION
    // ============================================

    setLanguage(language) {
        if (!this.isSupported) return;
        
        if (VoiceRecognitionConfig.supportedLanguages.includes(language)) {
            this.recognition.lang = language;
            this.settings.language = language;
            this.saveSettings();
            this.notifyListeners('language_changed', { language });
        } else {
            console.warn(`[VoiceRecognition] Language ${language} not supported`);
        }
    }

    setContinuous(continuous) {
        if (!this.isSupported) return;
        
        this.recognition.continuous = continuous;
        this.settings.continuous = continuous;
        this.saveSettings();
    }

    setInterimResults(interim) {
        if (!this.isSupported) return;
        
        this.recognition.interimResults = interim;
        this.settings.interimResults = interim;
        this.saveSettings();
    }

    setMaxAlternatives(max) {
        if (!this.isSupported) return;
        
        this.recognition.maxAlternatives = max;
        this.settings.maxAlternatives = max;
        this.saveSettings();
    }

    // ============================================
    // UTILITY METHODS
    // ============================================

    getBestResult() {
        if (this.results.length === 0) return null;
        
        const latestResults = this.results.slice(-5);
        let best = null;
        
        for (const result of latestResults) {
            for (const alt of result.alternatives) {
                if (alt.confidence >= VoiceRecognitionConfig.minConfidence) {
                    if (!best || alt.confidence > best.confidence) {
                        best = alt;
                    }
                }
            }
        }
        
        return best;
    }

    getLastResult() {
        if (this.results.length === 0) return null;
        
        const last = this.results[this.results.length - 1];
        return last.alternatives[0] || null;
    }

    getFullTranscript() {
        return this.results
            .filter(r => r.isFinal)
            .map(r => r.alternatives[0]?.transcript || '')
            .join(' ')
            .trim();
    }

    clearResults() {
        this.results = [];
        this.notifyListeners('results_cleared');
    }

    // ============================================
    // AUDIO ANALYSIS
    // ============================================

    async initAudioContext() {
        if (this.audioContext) return;
        
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        
        const source = this.audioContext.createMediaStreamSource(this.mediaStream);
        const analyser = this.audioContext.createAnalyser();
        analyser.fftSize = 256;
        
        source.connect(analyser);
        
        this.analyser = analyser;
        this.audioContext.resume();
        
        this.startAudioMonitoring();
    }

    startAudioMonitoring() {
        if (!this.analyser) return;
        
        const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
        
        const update = () => {
            if (!this.analyser) return;
            
            this.analyser.getByteFrequencyData(dataArray);
            const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
            const level = average / 255;
            
            this.notifyListeners('audio_level', { level, timestamp: Date.now() });
            
            requestAnimationFrame(update);
        };
        
        update();
    }

    closeAudioContext() {
        if (this.audioContext) {
            this.audioContext.close();
            this.audioContext = null;
        }
        
        if (this.mediaStream) {
            this.mediaStream.getTracks().forEach(track => track.stop());
            this.mediaStream = null;
        }
        
        this.analyser = null;
    }

    // ============================================
    // PERSISTENCE
    // ============================================

    loadSettings() {
        try {
            const saved = localStorage.getItem(VoiceRecognitionConfig.storageKey);
            if (saved) {
                return JSON.parse(saved);
            }
        } catch (error) {
            console.error('[VoiceRecognition] Failed to load settings:', error);
        }
        
        return {
            language: VoiceRecognitionConfig.defaultLanguage,
            continuous: VoiceRecognitionConfig.continuous,
            interimResults: VoiceRecognitionConfig.interimResults,
            maxAlternatives: VoiceRecognitionConfig.maxAlternatives,
            autoRestart: true
        };
    }

    saveSettings() {
        try {
            localStorage.setItem(VoiceRecognitionConfig.storageKey, JSON.stringify(this.settings));
        } catch (error) {
            console.error('[VoiceRecognition] Failed to save settings:', error);
        }
    }

    // ============================================
    // STATUS
    // ============================================

    isListening() {
        return this.isListening;
    }

    getStatus() {
        return {
            isSupported: this.isSupported,
            isListening: this.isListening,
            language: this.recognition?.lang,
            settings: this.settings,
            resultsCount: this.results.length
        };
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

const voiceRecognition = new VoiceRecognitionManager();

// Expose globally
window.voiceRecognition = voiceRecognition;

export { voiceRecognition, VoiceRecognitionManager, VoiceRecognitionConfig };