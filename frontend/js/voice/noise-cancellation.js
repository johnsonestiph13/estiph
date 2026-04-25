/**
 * ESTIF HOME ULTIMATE - NOISE CANCELLATION MODULE
 * Audio processing for noise reduction and voice enhancement
 * Version: 2.0.0
 * Author: Estifanos Yohannis
 */

// ============================================
// NOISE CANCELLATION CONFIGURATION
// ============================================

const NoiseCancellationConfig = {
    // Audio processing settings
    sampleRate: 16000,
    frameSize: 512,
    noiseFloor: -50,
    
    // Filters
    lowPassFreq: 4000,
    highPassFreq: 80,
    
    // Web Audio API
    useWebAudio: true,
    
    // Debug
    debug: false
};

// ============================================
// NOISE CANCELLATION MANAGER
// ============================================

class NoiseCancellationManager {
    constructor() {
        this.audioContext = null;
        self.sourceNode = null;
        self.analyserNode = null;
        self.filterNode = null;
        self.gainNode = null;
        self.mediaStream = null;
        self.isActive = false;
        self.noiseProfile = null;
        self.listeners = [];
        
        this.init();
    }

    init() {
        if (NoiseCancellationConfig.useWebAudio && window.AudioContext) {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            this.setupNodes();
        }
        NoiseCancellationConfig.debug && console.log('[NoiseCancellation] Manager initialized');
    }

    setupNodes() {
        if (!this.audioContext) return;
        
        // Analyser for noise profiling
        this.analyserNode = this.audioContext.createAnalyser();
        this.analyserNode.fftSize = NoiseCancellationConfig.frameSize;
        
        // Low-pass filter
        this.filterNode = this.audioContext.createBiquadFilter();
        this.filterNode.type = 'lowpass';
        this.filterNode.frequency.value = NoiseCancellationConfig.lowPassFreq;
        
        // Gain for volume adjustment
        this.gainNode = this.audioContext.createGain();
        this.gainNode.gain.value = 1.0;
    }

    // ============================================
    // AUDIO PROCESSING
    // ============================================

    async startNoiseCancellation(stream) {
        if (!this.audioContext) {
            console.warn('[NoiseCancellation] Web Audio not supported');
            return false;
        }
        
        try {
            this.mediaStream = stream;
            this.sourceNode = this.audioContext.createMediaStreamSource(stream);
            
            // Create a worklet for advanced noise reduction
            await this.loadNoiseReductionWorklet();
            
            // Connect nodes
            this.sourceNode.connect(this.filterNode);
            this.filterNode.connect(this.gainNode);
            this.gainNode.connect(this.analyserNode);
            this.analyserNode.connect(this.audioContext.destination);
            
            await this.audioContext.resume();
            this.isActive = true;
            
            // Start noise profiling
            this.startNoiseProfiling();
            
            this.notifyListeners('started');
            NoiseCancellationConfig.debug && console.log('[NoiseCancellation] Started');
            return true;
        } catch (error) {
            console.error('[NoiseCancellation] Failed to start:', error);
            return false;
        }
    }

    async loadNoiseReductionWorklet() {
        // Create a simple noise reduction processor
        const workletCode = `
            class NoiseReductionProcessor extends AudioWorkletProcessor {
                constructor() {
                    super();
                    this.noiseFloor = ${NoiseCancellationConfig.noiseFloor};
                }
                
                process(inputs, outputs, parameters) {
                    const input = inputs[0];
                    const output = outputs[0];
                    
                    if (input && output) {
                        for (let channel = 0; channel < input.length; channel++) {
                            const inputChannel = input[channel];
                            const outputChannel = output[channel];
                            
                            for (let i = 0; i < inputChannel.length; i++) {
                                let sample = inputChannel[i];
                                
                                // Simple noise gate
                                if (Math.abs(sample) < 0.01) {
                                    sample = 0;
                                }
                                
                                outputChannel[i] = sample;
                            }
                        }
                    }
                    
                    return true;
                }
            }
            
            registerProcessor('noise-reduction-processor', NoiseReductionProcessor);
        `;
        
        const blob = new Blob([workletCode], { type: 'application/javascript' });
        const url = URL.createObjectURL(blob);
        
        try {
            await this.audioContext.audioWorklet.addModule(url);
            const workletNode = new AudioWorkletNode(this.audioContext, 'noise-reduction-processor');
            
            // Reconnect with worklet
            this.sourceNode.disconnect();
            this.sourceNode.connect(workletNode);
            workletNode.connect(this.filterNode);
        } catch (error) {
            NoiseCancellationConfig.debug && console.log('[NoiseCancellation] Worklet not supported, using fallback');
        } finally {
            URL.revokeObjectURL(url);
        }
    }

    stopNoiseCancellation() {
        if (this.isActive && this.audioContext) {
            this.audioContext.suspend();
            this.isActive = false;
            this.notifyListeners('stopped');
            NoiseCancellationConfig.debug && console.log('[NoiseCancellation] Stopped');
        }
    }

    // ============================================
    // NOISE PROFILING
    // ============================================

    startNoiseProfiling() {
        if (!this.analyserNode) return;
        
        const dataArray = new Float32Array(this.analyserNode.frequencyBinCount);
        
        const collectNoiseProfile = () => {
            if (!this.isActive) return;
            
            this.analyserNode.getFloatFrequencyData(dataArray);
            
            // Calculate average noise level
            let sum = 0;
            for (let i = 0; i < dataArray.length; i++) {
                sum += dataArray[i];
            }
            const avgNoise = sum / dataArray.length;
            
            if (this.noiseProfile === null) {
                this.noiseProfile = avgNoise;
            } else {
                // Smooth the noise profile
                this.noiseProfile = this.noiseProfile * 0.9 + avgNoise * 0.1;
            }
            
            requestAnimationFrame(collectNoiseProfile);
        };
        
        requestAnimationFrame(collectNoiseProfile);
    }

    getNoiseLevel() {
        return this.noiseProfile;
    }

    // ============================================
    // AUDIO SETTINGS
    // ============================================

    setGain(value) {
        if (this.gainNode) {
            this.gainNode.gain.value = Math.max(0, Math.min(2, value));
        }
    }

    setLowPassFilter(frequency) {
        if (this.filterNode) {
            this.filterNode.frequency.value = frequency;
        }
    }

    // ============================================
    // UTILITY
    // ============================================

    isSupported() {
        return !!(window.AudioContext || window.webkitAudioContext);
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

const noiseCancellation = new NoiseCancellationManager();

// Expose globally
window.noiseCancellation = noiseCancellation;

export { noiseCancellation, NoiseCancellationManager, NoiseCancellationConfig };