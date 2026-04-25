/**
 * ESTIF HOME ULTIMATE - VOICE TRAINING MODULE
 * Voice model training for personalized wake word and command recognition
 * Version: 2.0.0
 * Author: Estifanos Yohannis
 */

// ============================================
// VOICE TRAINING CONFIGURATION
// ============================================

const VoiceTrainingConfig = {
    // Training settings
    samplesPerCommand: 10,
    sampleDuration: 2000, // milliseconds
    minSamplesRequired: 5,
    
    // Model storage
    storageKey: 'estif_voice_models',
    
    // Wake words
    wakeWords: ['hey estiph', 'hello estiph', 'estiph', 'ok estiph'],
    wakeWordsAm: ['ሰላም እስቲፍ', 'እስቲፍ', 'ሄይ እስቲፍ'],
    
    // Voice commands
    defaultCommands: [
        'turn on the light', 'turn off the light',
        'turn on the fan', 'turn off the fan',
        'turn on the ac', 'turn off the ac',
        'turn on the tv', 'turn off the tv',
        'turn on the heater', 'turn off the heater',
        'turn on the pump', 'turn off the pump',
        'all on', 'all off',
        'what is the temperature'
    ],
    
    // Debug
    debug: false
};

// ============================================
// VOICE MODEL CLASS
// ============================================

class VoiceModel {
    constructor(command, samples = []) {
        this.id = Date.now() + Math.random().toString(36);
        this.command = command;
        this.samples = samples;
        this.features = [];
        this.createdAt = Date.now();
        this.updatedAt = Date.now();
        this.accuracy = 0;
        this.isTrained = false;
    }
    
    addSample(audioData) {
        this.samples.push({
            id: Date.now(),
            data: audioData,
            timestamp: Date.now()
        });
        this.updatedAt = Date.now();
        this.isTrained = false;
    }
    
    extractFeatures() {
        // Extract MFCC-like features from audio samples
        this.features = this.samples.map(sample => this.computeFeatures(sample.data));
        this.isTrained = true;
        this.updatedAt = Date.now();
    }
    
    computeFeatures(audioData) {
        // Simplified feature extraction
        const features = {
            energy: this.computeEnergy(audioData),
            zeroCrossingRate: this.computeZeroCrossingRate(audioData),
            spectralCentroid: this.computeSpectralCentroid(audioData),
            duration: audioData.length
        };
        return features;
    }
    
    computeEnergy(audioData) {
        let sum = 0;
        for (let i = 0; i < audioData.length; i++) {
            sum += audioData[i] * audioData[i];
        }
        return sum / audioData.length;
    }
    
    computeZeroCrossingRate(audioData) {
        let crossings = 0;
        for (let i = 1; i < audioData.length; i++) {
            if (audioData[i] * audioData[i-1] < 0) {
                crossings++;
            }
        }
        return crossings / audioData.length;
    }
    
    computeSpectralCentroid(audioData) {
        // Simplified spectral centroid calculation
        let sum = 0;
        let weightedSum = 0;
        for (let i = 0; i < audioData.length; i++) {
            sum += audioData[i];
            weightedSum += i * audioData[i];
        }
        return sum === 0 ? 0 : weightedSum / sum;
    }
    
    recognize(audioData, threshold = 0.6) {
        if (!this.isTrained || this.features.length === 0) {
            return false;
        }
        
        const inputFeatures = this.computeFeatures(audioData);
        let bestMatch = 0;
        
        for (const feature of this.features) {
            const similarity = this.computeSimilarity(inputFeatures, feature);
            bestMatch = Math.max(bestMatch, similarity);
        }
        
        return bestMatch >= threshold;
    }
    
    computeSimilarity(f1, f2) {
        let similarity = 0;
        let count = 0;
        
        for (const key in f1) {
            if (f2[key]) {
                const diff = Math.abs(f1[key] - f2[key]);
                similarity += 1 / (1 + diff);
                count++;
            }
        }
        
        return count === 0 ? 0 : similarity / count;
    }
    
    getStats() {
        return {
            command: this.command,
            sampleCount: this.samples.length,
            isTrained: this.isTrained,
            accuracy: this.accuracy,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt
        };
    }
    
    toJSON() {
        return {
            id: this.id,
            command: this.command,
            samples: this.samples,
            features: this.features,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt,
            accuracy: this.accuracy,
            isTrained: this.isTrained
        };
    }
    
    static fromJSON(data) {
        const model = new VoiceModel(data.command);
        model.id = data.id;
        model.samples = data.samples;
        model.features = data.features;
        model.createdAt = data.createdAt;
        model.updatedAt = data.updatedAt;
        model.accuracy = data.accuracy;
        model.isTrained = data.isTrained;
        return model;
    }
}

// ============================================
// VOICE TRAINING MANAGER
// ============================================

class VoiceTrainingManager {
    constructor() {
        this.models = new Map();
        self.recording = false;
        self.mediaRecorder = null;
        self.audioChunks = [];
        self.listeners = [];
        
        this.init();
    }

    init() {
        this.loadModels();
        VoiceTrainingConfig.debug && console.log('[VoiceTraining] Manager initialized');
    }

    loadModels() {
        try {
            const saved = localStorage.getItem(VoiceTrainingConfig.storageKey);
            if (saved) {
                const data = JSON.parse(saved);
                for (const [command, modelData] of Object.entries(data)) {
                    const model = VoiceModel.fromJSON(modelData);
                    this.models.set(command, model);
                }
                VoiceTrainingConfig.debug && console.log('[VoiceTraining] Loaded', this.models.size, 'models');
            }
        } catch (error) {
            console.error('[VoiceTraining] Failed to load models:', error);
        }
    }

    saveModels() {
        try {
            const data = {};
            for (const [command, model] of this.models.entries()) {
                data[command] = model.toJSON();
            }
            localStorage.setItem(VoiceTrainingConfig.storageKey, JSON.stringify(data));
            VoiceTrainingConfig.debug && console.log('[VoiceTraining] Saved', this.models.size, 'models');
        } catch (error) {
            console.error('[VoiceTraining] Failed to save models:', error);
        }
    }

    // ============================================
    // MODEL MANAGEMENT
    // ============================================

    async createModel(command) {
        if (this.models.has(command)) {
            return this.models.get(command);
        }
        
        const model = new VoiceModel(command);
        this.models.set(command, model);
        this.saveModels();
        this.notifyListeners('model_created', { command });
        return model;
    }

    getModel(command) {
        return this.models.get(command);
    }

    getAllModels() {
        return Array.from(this.models.values());
    }

    deleteModel(command) {
        const deleted = this.models.delete(command);
        if (deleted) {
            this.saveModels();
            this.notifyListeners('model_deleted', { command });
        }
        return deleted;
    }

    // ============================================
    // TRAINING
    // ============================================

    async startRecording() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            this.mediaRecorder = new MediaRecorder(stream);
            this.audioChunks = [];
            
            this.mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    this.audioChunks.push(event.data);
                }
            };
            
            this.mediaRecorder.onstop = () => {
                this.processRecording();
            };
            
            this.mediaRecorder.start();
            this.recording = true;
            this.notifyListeners('recording_started');
            
            // Auto-stop after sample duration
            setTimeout(() => {
                if (this.recording) {
                    this.stopRecording();
                }
            }, VoiceTrainingConfig.sampleDuration);
            
        } catch (error) {
            console.error('[VoiceTraining] Failed to start recording:', error);
            this.notifyListeners('error', { error });
        }
    }

    stopRecording() {
        if (this.mediaRecorder && this.recording) {
            this.mediaRecorder.stop();
            this.recording = false;
            
            // Stop all tracks
            if (this.mediaRecorder.stream) {
                this.mediaRecorder.stream.getTracks().forEach(track => track.stop());
            }
            
            this.notifyListeners('recording_stopped');
        }
    }

    async processRecording() {
        const blob = new Blob(this.audioChunks, { type: 'audio/webm' });
        const audioData = await this.blobToAudioData(blob);
        
        this.notifyListeners('recording_processed', { audioData, blob });
        return audioData;
    }

    async blobToAudioData(blob) {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => {
                const arrayBuffer = reader.result;
                const audioData = new Float32Array(arrayBuffer);
                resolve(audioData);
            };
            reader.readAsArrayBuffer(blob);
        });
    }

    async trainModel(command) {
        let model = this.getModel(command);
        if (!model) {
            model = await this.createModel(command);
        }
        
        if (model.samples.length < VoiceTrainingConfig.minSamplesRequired) {
            this.notifyListeners('insufficient_samples', { 
                command, 
                current: model.samples.length,
                required: VoiceTrainingConfig.minSamplesRequired
            });
            return false;
        }
        
        model.extractFeatures();
        this.saveModels();
        this.notifyListeners('model_trained', { command, samples: model.samples.length });
        
        return true;
    }

    // ============================================
    // RECOGNITION
    // ============================================

    async recognizeCommand(audioData) {
        const results = [];
        
        for (const [command, model] of this.models.entries()) {
            if (model.isTrained) {
                const isMatch = model.recognize(audioData);
                if (isMatch) {
                    results.push({ command, confidence: 0.8 });
                }
            }
        }
        
        // Sort by confidence and return best match
        results.sort((a, b) => b.confidence - a.confidence);
        return results[0] || null;
    }

    // ============================================
    // UTILITY
    // ============================================

    getTrainingStatus(command) {
        const model = this.getModel(command);
        if (!model) {
            return { trained: false, samples: 0, required: VoiceTrainingConfig.minSamplesRequired };
        }
        
        return {
            trained: model.isTrained,
            samples: model.samples.length,
            required: VoiceTrainingConfig.minSamplesRequired,
            accuracy: model.accuracy
        };
    }

    getWakeWords() {
        const lang = localStorage.getItem('estif_language') || 'en';
        return lang === 'am' ? VoiceTrainingConfig.wakeWordsAm : VoiceTrainingConfig.wakeWords;
    }

    getDefaultCommands() {
        return VoiceTrainingConfig.defaultCommands;
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

const voiceTraining = new VoiceTrainingManager();

// Expose globally
window.voiceTraining = voiceTraining;

export { voiceTraining, VoiceTrainingManager, VoiceTrainingConfig, VoiceModel };