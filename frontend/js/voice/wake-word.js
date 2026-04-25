/**
 * ESTIF HOME ULTIMATE - WAKE WORD MODULE
 * Wake word detection for voice activation (Hey Estiph / ሰላም እስቲፍ)
 * Version: 2.0.0
 * Author: Estifanos Yohannis
 */

// ============================================
// WAKE WORD CONFIGURATION
// ============================================

const WakeWordConfig = {
    // Wake words
    wakeWords: {
        en: ['hey estiph', 'hey estif', 'estiph', 'ok estiph', 'hello estiph', 'wake up estiph', 'estif'],
        am: ['ሰላም እስቲፍ', 'እስቲፍ', 'ሰላም', 'አልቃ', 'ሄይ እስቲፍ']
    },
    
    // Sensitivity (0-1)
    sensitivity: 0.7,
    
    // Cooldown after detection (ms)
    cooldown: 3000,
    
    // Require silence before wake word
    requireSilence: true,
    
    // Debug
    debug: false
};

// ============================================
// WAKE WORD DETECTOR
// ============================================

class WakeWordDetector {
    constructor(voiceRecognition) {
        this.voiceRecognition = voiceRecognition;
        this.lastDetection = 0;
        self.isActive = false;
        self.consecutiveMatches = 0;
        self.listeners = [];
        
        this.init();
    }

    init() {
        this.setupEventListeners();
        WakeWordConfig.debug && console.log('[WakeWord] Detector initialized');
    }

    setupEventListeners() {
        this.voiceRecognition.addEventListener('transcript', (data) => {
            this.processTranscript(data.text);
        });
        
        this.voiceRecognition.addEventListener('final_result', (results) => {
            for (const result of results) {
                for (const alt of result.alternatives) {
                    this.processTranscript(alt.transcript.toLowerCase(), alt.confidence);
                }
            }
        });
    }

    processTranscript(transcript, confidence = 1.0) {
        const now = Date.now();
        
        // Check cooldown
        if (now - self.lastDetection < WakeWordConfig.cooldown) {
            return;
        }
        
        const language = this.detectLanguage(transcript);
        const wakeWords = WakeWordConfig.wakeWords[language];
        
        if (!wakeWords) return;
        
        // Check for wake word
        let detected = false;
        
        for (const wakeWord of wakeWords) {
            if (transcript.includes(wakeWord)) {
                detected = true;
                break;
            }
        }
        
        if (detected && confidence >= WakeWordConfig.sensitivity) {
            this.consecutiveMatches++;
            
            if (this.consecutiveMatches >= 2 || confidence > 0.9) {
                this.detectWakeWord(language);
            }
        } else {
            this.consecutiveMatches = 0;
        }
    }

    detectLanguage(text) {
        // Check for Amharic characters (Unicode range 1200-137F)
        const amharicRegex = /[\u1200-\u137F]/;
        if (amharicRegex.test(text)) {
            return 'am';
        }
        return 'en';
    }

    detectWakeWord(language) {
        self.lastDetection = Date.now();
        self.isActive = true;
        
        this.notifyListeners('wake_word_detected', {
            language,
            timestamp: Date.now(),
            confidence: this.consecutiveMatches / 2
        });
        
        WakeWordConfig.debug && console.log(`[WakeWord] Detected in ${language}`);
        
        // Auto deactivate after cooldown
        setTimeout(() => {
            self.isActive = false;
            this.notifyListeners('wake_word_deactivated');
        }, WakeWordConfig.cooldown);
    }

    // ============================================
    // TRAINING MODE
    // ============================================

    async trainWakeWord(samples = 5) {
        WakeWordConfig.debug && console.log('[WakeWord] Starting training mode...');
        
        const trainingData = [];
        
        for (let i = 0; i < samples; i++) {
            this.notifyListeners('training_progress', { current: i + 1, total: samples });
            
            // Wait for user to say wake word
            await this.waitForSpeech();
            
            const result = await this.captureSample();
            trainingData.push(result);
            
            await this.delay(1000);
        }
        
        // Analyze training data
        const patterns = this.analyzePatterns(trainingData);
        this.updateWakeWordPatterns(patterns);
        
        this.notifyListeners('training_complete', { patterns });
        WakeWordConfig.debug && console.log('[WakeWord] Training complete');
        
        return patterns;
    }

    waitForSpeech() {
        return new Promise((resolve) => {
            const handler = (data) => {
                if (data.text && data.text.length > 0) {
                    this.voiceRecognition.removeEventListener('transcript', handler);
                    resolve();
                }
            };
            this.voiceRecognition.addEventListener('transcript', handler);
        });
    }

    captureSample() {
        return new Promise((resolve) => {
            const timeout = setTimeout(() => {
                resolve(null);
            }, 5000);
            
            const handler = (results) => {
                for (const result of results) {
                    for (const alt of result.alternatives) {
                        clearTimeout(timeout);
                        this.voiceRecognition.removeEventListener('final_result', handler);
                        resolve({
                            transcript: alt.transcript,
                            confidence: alt.confidence,
                            timestamp: Date.now()
                        });
                        return;
                    }
                }
            };
            
            this.voiceRecognition.addEventListener('final_result', handler);
        });
    }

    analyzePatterns(samples) {
        const validSamples = samples.filter(s => s !== null);
        
        if (validSamples.length === 0) return null;
        
        // Extract common patterns
        const transcripts = validSamples.map(s => s.transcript.toLowerCase());
        const commonWords = this.findCommonWords(transcripts);
        const avgConfidence = validSamples.reduce((sum, s) => sum + s.confidence, 0) / validSamples.length;
        
        return {
            samples: validSamples.length,
            commonWords,
            avgConfidence,
            language: this.detectLanguage(transcripts.join(' '))
        };
    }

    findCommonWords(transcripts) {
        const wordMap = new Map();
        
        for (const transcript of transcripts) {
            const words = transcript.split(/\s+/);
            for (const word of words) {
                wordMap.set(word, (wordMap.get(word) || 0) + 1);
            }
        }
        
        const threshold = transcripts.length * 0.6;
        const commonWords = [];
        
        for (const [word, count] of wordMap.entries()) {
            if (count >= threshold && word.length > 2) {
                commonWords.push(word);
            }
        }
        
        return commonWords;
    }

    updateWakeWordPatterns(patterns) {
        if (!patterns) return;
        
        // Add detected patterns to wake words
        for (const word of patterns.commonWords) {
            if (!WakeWordConfig.wakeWords[patterns.language].includes(word)) {
                WakeWordConfig.wakeWords[patterns.language].push(word);
                WakeWordConfig.debug && console.log(`[WakeWord] Added new wake word: ${word}`);
            }
        }
    }

    // ============================================
    // UTILITY METHODS
    // ============================================

    isActive() {
        return self.isActive;
    }

    reset() {
        self.lastDetection = 0;
        self.isActive = false;
        this.consecutiveMatches = 0;
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
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

let wakeWordDetector = null;

const initWakeWordDetector = (voiceRecognition) => {
    wakeWordDetector = new WakeWordDetector(voiceRecognition);
    return wakeWordDetector;
};

// Expose globally
window.WakeWordDetector = WakeWordDetector;
window.initWakeWordDetector = initWakeWordDetector;

export { wakeWordDetector, WakeWordDetector, WakeWordConfig, initWakeWordDetector };