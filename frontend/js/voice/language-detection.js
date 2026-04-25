/**
 * ESTIF HOME ULTIMATE - LANGUAGE DETECTION MODULE
 * Automatic language detection from text and speech
 * Version: 2.0.0
 * Author: Estifanos Yohannis
 */

// ============================================
// LANGUAGE DETECTION CONFIGURATION
// ============================================

const LanguageDetectionConfig = {
    // Confidence threshold
    confidenceThreshold: 0.7,
    
    // Supported languages with detection patterns
    languages: {
        en: { name: 'English', patterns: [/the/, /and/, /to/, /of/, /is/, /in/], script: 'latin' },
        am: { name: 'Amharic', patterns: [/ለ/, /መ/, /ሰ/, /ሸ/, /ቀ/, /በ/], script: 'ethiopic' },
        ar: { name: 'Arabic', patterns: [/ال/, /في/, /من/, /إلى/, /على/], script: 'arabic' },
        fr: { name: 'French', patterns: [/le/, /la/, /les/, /et/, /de/, /est/], script: 'latin' },
        es: { name: 'Spanish', patterns: [/el/, /la/, /los/, /las/, /y/, /de/], script: 'latin' },
        de: { name: 'German', patterns: [/der/, /die/, /und/, /ist/, /zu/], script: 'latin' },
        zh: { name: 'Chinese', patterns: [/的/, /了/, /是/, /我/, /不/], script: 'cjk' }
    },
    
    // Script detection regex
    scripts: {
        latin: /[a-zA-Z]/,
        ethiopic: /[\u1200-\u137F]/,
        arabic: /[\u0600-\u06FF]/,
        cjk: /[\u4E00-\u9FFF\u3400-\u4DBF\u3000-\u303F]/
    },
    
    // Debug
    debug: false
};

// ============================================
// LANGUAGE DETECTION MANAGER
// ============================================

class LanguageDetectionManager {
    constructor() {
        this.listeners = [];
        this.init();
    }

    init() {
        LanguageDetectionConfig.debug && console.log('[LanguageDetection] Manager initialized');
    }

    // ============================================
    // DETECTION METHODS
    // ============================================

    detectLanguage(text) {
        if (!text || text.trim().length === 0) {
            return { language: null, confidence: 0, message: 'Empty text' };
        }
        
        const scores = {};
        const totalChars = text.length;
        
        // Check script first
        const detectedScript = this.detectScript(text);
        
        for (const [langCode, langData] of Object.entries(LanguageDetectionConfig.languages)) {
            let score = 0;
            
            // Script match gives base score
            if (langData.script === detectedScript) {
                score += 0.3;
            }
            
            // Check patterns
            for (const pattern of langData.patterns) {
                const matches = (text.match(pattern) || []).length;
                score += (matches / totalChars) * 10;
            }
            
            // Cap score at 1
            scores[langCode] = Math.min(score, 1);
        }
        
        // Find best match
        let bestLang = null;
        let bestScore = 0;
        
        for (const [langCode, score] of Object.entries(scores)) {
            if (score > bestScore) {
                bestScore = score;
                bestLang = langCode;
            }
        }
        
        const result = {
            language: bestScore >= LanguageDetectionConfig.confidenceThreshold ? bestLang : null,
            confidence: bestScore,
            scores: scores,
            detectedScript: detectedScript,
            allScores: scores
        };
        
        LanguageDetectionConfig.debug && console.log('[LanguageDetection] Detected:', result);
        
        return result;
    }

    detectScript(text) {
        for (const [script, regex] of Object.entries(LanguageDetectionConfig.scripts)) {
            if (regex.test(text)) {
                return script;
            }
        }
        return 'unknown';
    }

    // ============================================
    // SPEECH LANGUAGE DETECTION
    // ============================================

    detectFromSpeech(transcript, interimResults = []) {
        // Combine all results for better accuracy
        const fullText = [transcript, ...interimResults].join(' ');
        return this.detectLanguage(fullText);
    }

    // ============================================
    // LANGUAGE VALIDATION
    // ============================================

    isLanguageSupported(langCode) {
        return !!LanguageDetectionConfig.languages[langCode];
    }

    getSupportedLanguages() {
        return Object.entries(LanguageDetectionConfig.languages).map(([code, data]) => ({
            code,
            name: data.name,
            script: data.script
        }));
    }

    getLanguageName(langCode) {
        return LanguageDetectionConfig.languages[langCode]?.name || langCode;
    }

    // ============================================
    // TEXT ANALYSIS
    // ============================================

    getLanguageConfidence(text, langCode) {
        const result = this.detectLanguage(text);
        return result.scores[langCode] || 0;
    }

    isTextInLanguage(text, langCode, threshold = 0.6) {
        const confidence = this.getLanguageConfidence(text, langCode);
        return confidence >= threshold;
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

const languageDetector = new LanguageDetectionManager();

// Expose globally
window.languageDetector = languageDetector;

export { languageDetector, LanguageDetectionManager, LanguageDetectionConfig };