/**
 * ESTIF HOME ULTIMATE - NETWORK MONITOR MODULE
 * Real-time network status monitoring, speed tests, and connection quality tracking
 * Version: 2.0.0
 * Author: Estifanos Yohannis
 */

// ============================================
// NETWORK MONITOR CONFIGURATION
// ============================================

const NetworkMonitorConfig = {
    // Ping endpoints
    pingEndpoints: [
        'https://www.google.com',
        'https://www.cloudflare.com',
        'https://api.github.com',
        'https://estif-home.com/api/health'
    ],
    
    // Speed test settings
    speedTest: {
        enabled: true,
        testFile: '/assets/speed-test-file.bin',
        testFileSize: 5 * 1024 * 1024, // 5MB
        concurrentRequests: 3,
        timeout: 30000
    },
    
    // Monitoring intervals (ms)
    intervals: {
        ping: 30000,      // 30 seconds
        bandwidth: 60000, // 1 minute
        quality: 15000    // 15 seconds
    },
    
    // Quality thresholds
    qualityThresholds: {
        excellent: { latency: 50, jitter: 10, packetLoss: 1 },
        good: { latency: 100, jitter: 20, packetLoss: 3 },
        fair: { latency: 200, jitter: 50, packetLoss: 5 },
        poor: { latency: 500, jitter: 100, packetLoss: 10 }
    },
    
    // Alert settings
    alerts: {
        enabled: true,
        cooldown: 60000, // 1 minute between alerts
        thresholds: {
          latencyWarning: 200,
          latencyCritical: 500,
          packetLossWarning: 5,
          packetLossCritical: 10
        }
    },
    
    // History
    historySize: 100,
    
    // Debug
    debug: false
};

// ============================================
// NETWORK QUALITY METRICS
// ============================================

class NetworkQuality {
    constructor() {
        this.metrics = {
          latency: {
            current: 0,
            average: 0,
            min: Infinity,
            max: 0,
            history: []
          },
          jitter: {
            current: 0,
            average: 0,
            history: []
          },
          packetLoss: {
            current: 0,
            average: 0,
            history: []
          },
          bandwidth: {
            current: 0,
            average: 0,
            down: 0,
            up: 0,
            history: []
          },
          signalStrength: {
            current: 0,
            average: 0
          }
        };
        
        this.quality = 'unknown';
        this.lastUpdate = null;
    }

    updateLatency(latency) {
        this.metrics.latency.current = latency;
        this.metrics.latency.history.push(latency);
        this.metrics.latency.min = Math.min(this.metrics.latency.min, latency);
        this.metrics.latency.max = Math.max(this.metrics.latency.max, latency);
        this.metrics.latency.average = this.calculateAverage(this.metrics.latency.history);
        
        this.trimHistory('latency');
    }

    updateJitter(jitter) {
        this.metrics.jitter.current = jitter;
        this.metrics.jitter.history.push(jitter);
        this.metrics.jitter.average = this.calculateAverage(this.metrics.jitter.history);
        
        this.trimHistory('jitter');
    }

    updatePacketLoss(loss) {
        this.metrics.packetLoss.current = loss;
        this.metrics.packetLoss.history.push(loss);
        this.metrics.packetLoss.average = this.calculateAverage(this.metrics.packetLoss.history);
        
        this.trimHistory('packetLoss');
    }

    updateBandwidth(down, up) {
        this.metrics.bandwidth.current = down;
        this.metrics.bandwidth.down = down;
        this.metrics.bandwidth.up = up;
        this.metrics.bandwidth.history.push(down);
        this.metrics.bandwidth.average = this.calculateAverage(this.metrics.bandwidth.history);
        
        this.trimHistory('bandwidth');
    }

    updateSignalStrength(strength) {
        this.metrics.signalStrength.current = strength;
        this.metrics.signalStrength.average = this.calculateAverage(
            [this.metrics.signalStrength.average, strength]
        );
    }

    calculateAverage(values) {
        if (values.length === 0) return 0;
        const sum = values.reduce((a, b) => a + b, 0);
        return sum / values.length;
    }

    trimHistory(metric) {
        if (this.metrics[metric].history.length > NetworkMonitorConfig.historySize) {
            this.metrics[metric].history.shift();
        }
    }

    calculateQuality() {
        const { latency, jitter, packetLoss } = this.metrics;
        const thresholds = NetworkMonitorConfig.qualityThresholds;
        
        if (latency.current <= thresholds.excellent.latency &&
            jitter.current <= thresholds.excellent.jitter &&
            packetLoss.current <= thresholds.excellent.packetLoss) {
            this.quality = 'excellent';
        } else if (latency.current <= thresholds.good.latency &&
                   jitter.current <= thresholds.good.jitter &&
                   packetLoss.current <= thresholds.good.packetLoss) {
            this.quality = 'good';
        } else if (latency.current <= thresholds.fair.latency &&
                   jitter.current <= thresholds.fair.jitter &&
                   packetLoss.current <= thresholds.fair.packetLoss) {
            this.quality = 'fair';
        } else if (latency.current <= thresholds.poor.latency &&
                   jitter.current <= thresholds.poor.jitter &&
                   packetLoss.current <= thresholds.poor.packetLoss) {
            this.quality = 'poor';
        } else {
            this.quality = 'very-poor';
        }
        
        this.lastUpdate = Date.now();
        return this.quality;
    }

    getQualityColor() {
        const colors = {
            'excellent': '#06d6a0',
            'good': '#4cc9f0',
            'fair': '#ffd166',
            'poor': '#f9c74f',
            'very-poor': '#ef476f',
            'unknown': '#6c757d'
        };
        return colors[this.quality] || colors.unknown;
    }

    getQualityLabel() {
        const labels = {
            'excellent': 'Excellent',
            'good': 'Good',
            'fair': 'Fair',
            'poor': 'Poor',
            'very-poor': 'Very Poor',
            'unknown': 'Unknown'
        };
        return labels[this.quality] || labels.unknown;
    }

    getSummary() {
        return {
            quality: this.quality,
            label: this.getQualityLabel(),
            color: this.getQualityColor(),
            latency: {
                current: Math.round(this.metrics.latency.current),
                average: Math.round(this.metrics.latency.average),
                min: Math.round(this.metrics.latency.min),
                max: Math.round(this.metrics.latency.max)
            },
            jitter: {
                current: Math.round(this.metrics.jitter.current),
                average: Math.round(this.metrics.jitter.average)
            },
            packetLoss: {
                current: this.metrics.packetLoss.current.toFixed(2),
                average: this.metrics.packetLoss.average.toFixed(2)
            },
            bandwidth: {
                current: this.formatBandwidth(this.metrics.bandwidth.current),
                average: this.formatBandwidth(this.metrics.bandwidth.average),
                down: this.formatBandwidth(this.metrics.bandwidth.down),
                up: this.formatBandwidth(this.metrics.bandwidth.up)
            },
            signalStrength: this.metrics.signalStrength.current,
            lastUpdate: this.lastUpdate
        };
    }

    formatBandwidth(bps) {
        if (bps >= 1e6) return `${(bps / 1e6).toFixed(1)} Mbps`;
        if (bps >= 1e3) return `${(bps / 1e3).toFixed(1)} Kbps`;
        return `${bps} bps`;
    }

    reset() {
        this.metrics = {
            latency: { current: 0, average: 0, min: Infinity, max: 0, history: [] },
            jitter: { current: 0, average: 0, history: [] },
            packetLoss: { current: 0, average: 0, history: [] },
            bandwidth: { current: 0, average: 0, down: 0, up: 0, history: [] },
            signalStrength: { current: 0, average: 0 }
        };
        this.quality = 'unknown';
    }
}

// ============================================
// NETWORK MONITOR
// ============================================

class NetworkMonitor {
    constructor() {
        this.quality = new NetworkQuality();
        this.isOnline = navigator.onLine;
        this.connectionType = 'unknown';
        this.effectiveType = 'unknown';
        this.rtt = 0;
        this.downlink = 0;
        this.saveData = false;
        
        this.monitors = {
            ping: null,
            bandwidth: null,
            quality: null
        };
        
        this.listeners = [];
        this.alertCooldowns = new Map();
        
        this.init();
    }

    init() {
        this.detectConnection();
        this.setupEventListeners();
        this.startMonitoring();
        NetworkMonitorConfig.debug && console.log('[NetworkMonitor] Initialized');
    }

    detectConnection() {
        if ('connection' in navigator) {
            const conn = navigator.connection;
            this.connectionType = conn.type || 'unknown';
            this.effectiveType = conn.effectiveType || 'unknown';
            this.rtt = conn.rtt || 0;
            this.downlink = conn.downlink || 0;
            this.saveData = conn.saveData || false;
            
            if (conn.addEventListener) {
                conn.addEventListener('change', () => this.onConnectionChange());
            }
        }
        
        // Detect using Network Information API fallback
        this.detectViaAPI();
    }

    detectViaAPI() {
        fetch('/api/network-info')
            .then(res => res.json())
            .then(data => {
                if (data.type) this.connectionType = data.type;
                if (data.speed) this.downlink = data.speed;
            })
            .catch(() => {});
    }

    onConnectionChange() {
        const conn = navigator.connection;
        this.connectionType = conn.type || 'unknown';
        this.effectiveType = conn.effectiveType || 'unknown';
        this.rtt = conn.rtt || 0;
        this.downlink = conn.downlink || 0;
        this.saveData = conn.saveData || false;
        
        this.notifyListeners('connection_change', this.getConnectionInfo());
    }

    setupEventListeners() {
        window.addEventListener('online', () => {
            this.isOnline = true;
            this.notifyListeners('online', { timestamp: Date.now() });
            this.startMonitoring();
        });
        
        window.addEventListener('offline', () => {
            this.isOnline = false;
            this.notifyListeners('offline', { timestamp: Date.now() });
            this.stopMonitoring();
        });
    }

    // ============================================
    // MONITORING
    // ============================================

    startMonitoring() {
        this.startPingMonitor();
        this.startBandwidthMonitor();
        this.startQualityMonitor();
    }

    stopMonitoring() {
        if (this.monitors.ping) clearInterval(this.monitors.ping);
        if (this.monitors.bandwidth) clearInterval(this.monitors.bandwidth);
        if (this.monitors.quality) clearInterval(this.monitors.quality);
    }

    startPingMonitor() {
        this.monitors.ping = setInterval(async () => {
            if (this.isOnline) {
                const latency = await this.measureLatency();
                const jitter = await this.measureJitter();
                this.quality.updateLatency(latency);
                this.quality.updateJitter(jitter);
                this.checkLatencyAlert(latency);
                this.notifyListeners('ping_update', { latency, jitter });
            }
        }, NetworkMonitorConfig.intervals.ping);
        
        // Initial ping
        this.measureLatency().then(latency => {
            this.quality.updateLatency(latency);
        });
    }

    startBandwidthMonitor() {
        if (!NetworkMonitorConfig.speedTest.enabled) return;
        
        this.monitors.bandwidth = setInterval(async () => {
            if (this.isOnline) {
                const { down, up } = await this.measureBandwidth();
                this.quality.updateBandwidth(down, up);
                this.notifyListeners('bandwidth_update', { down, up });
            }
        }, NetworkMonitorConfig.intervals.bandwidth);
    }

    startQualityMonitor() {
        this.monitors.quality = setInterval(() => {
            const quality = this.quality.calculateQuality();
            this.checkPacketLossAlert();
            this.notifyListeners('quality_update', {
                quality,
                summary: this.quality.getSummary()
            });
        }, NetworkMonitorConfig.intervals.quality);
    }

    // ============================================
    // MEASUREMENT METHODS
    // ============================================

    async measureLatency() {
        const startTime = performance.now();
        
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);
            
            await fetch(NetworkMonitorConfig.pingEndpoints[0], {
                method: 'HEAD',
                mode: 'no-cors',
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            const endTime = performance.now();
            return endTime - startTime;
        } catch (error) {
            return 9999; // High latency on error
        }
    }

    async measureJitter(samples = 5) {
        const latencies = [];
        
        for (let i = 0; i < samples; i++) {
            const latency = await this.measureLatency();
            latencies.push(latency);
            await this.delay(100);
        }
        
        // Calculate jitter: average of absolute differences between consecutive latencies
        let jitter = 0;
        for (let i = 1; i < latencies.length; i++) {
            jitter += Math.abs(latencies[i] - latencies[i - 1]);
        }
        jitter /= (latencies.length - 1);
        
        return jitter;
    }

    async measurePacketLoss(samples = 10) {
        let lost = 0;
        
        for (let i = 0; i < samples; i++) {
            const startTime = performance.now();
            
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 2000);
                
                await fetch(NetworkMonitorConfig.pingEndpoints[0], {
                    method: 'HEAD',
                    signal: controller.signal
                });
                
                clearTimeout(timeoutId);
            } catch (error) {
                lost++;
            }
            
            await this.delay(100);
        }
        
        return (lost / samples) * 100;
    }

    async measureBandwidth() {
        const testFile = NetworkMonitorConfig.speedTest.testFile;
        const fileSize = NetworkMonitorConfig.speedTest.testFileSize;
        
        // Measure download speed
        let downSpeed = 0;
        try {
            const startTime = performance.now();
            
            const response = await fetch(testFile, {
                cache: 'no-store'
            });
            
            const data = await response.arrayBuffer();
            const endTime = performance.now();
            const duration = (endTime - startTime) / 1000;
            
            downSpeed = (fileSize * 8) / duration; // bits per second
        } catch (error) {
            NetworkMonitorConfig.debug && console.log('[NetworkMonitor] Bandwidth test failed:', error);
        }
        
        // Measure upload speed (simulated)
        let upSpeed = downSpeed * 0.3; // Rough estimate (30% of download)
        
        return { down: downSpeed, up: upSpeed };
    }

    async measureSignalStrength() {
        if ('getBattery' in navigator) {
            // Not directly related, but can indicate device status
            const battery = await navigator.getBattery();
            return battery.level * 100;
        }
        
        // Estimate based on connection type
        const strengthMap = {
            'slow-2g': 20,
            '2g': 30,
            '3g': 50,
            '4g': 80,
            '5g': 95,
            'wifi': 90,
            'ethernet': 100
        };
        
        return strengthMap[this.effectiveType] || 50;
    }

    // ============================================
    // ALERTING
    // ============================================

    checkLatencyAlert(latency) {
        if (!NetworkMonitorConfig.alerts.enabled) return;
        
        const { latencyWarning, latencyCritical } = NetworkMonitorConfig.alerts.thresholds;
        
        if (latency >= latencyCritical && !this.isAlertOnCooldown('latency_critical')) {
            this.triggerAlert('latency_critical', {
                message: `Critical latency detected: ${Math.round(latency)}ms`,
                value: latency,
                threshold: latencyCritical
            });
        } else if (latency >= latencyWarning && !this.isAlertOnCooldown('latency_warning')) {
            this.triggerAlert('latency_warning', {
                message: `High latency detected: ${Math.round(latency)}ms`,
                value: latency,
                threshold: latencyWarning
            });
        }
    }

    checkPacketLossAlert() {
        if (!NetworkMonitorConfig.alerts.enabled) return;
        
        const loss = this.quality.metrics.packetLoss.current;
        const { packetLossWarning, packetLossCritical } = NetworkMonitorConfig.alerts.thresholds;
        
        if (loss >= packetLossCritical && !this.isAlertOnCooldown('packet_loss_critical')) {
            this.triggerAlert('packet_loss_critical', {
                message: `Critical packet loss detected: ${loss.toFixed(2)}%`,
                value: loss,
                threshold: packetLossCritical
            });
        } else if (loss >= packetLossWarning && !this.isAlertOnCooldown('packet_loss_warning')) {
            this.triggerAlert('packet_loss_warning', {
                message: `High packet loss detected: ${loss.toFixed(2)}%`,
                value: loss,
                threshold: packetLossWarning
            });
        }
    }

    triggerAlert(type, data) {
        this.setAlertCooldown(type);
        this.notifyListeners('alert', { type, ...data });
        
        NetworkMonitorConfig.debug && console.log(`[NetworkMonitor] Alert: ${type}`, data);
    }

    isAlertOnCooldown(type) {
        const lastTrigger = this.alertCooldowns.get(type);
        if (!lastTrigger) return false;
        return (Date.now() - lastTrigger) < NetworkMonitorConfig.alerts.cooldown;
    }

    setAlertCooldown(type) {
        this.alertCooldowns.set(type, Date.now());
    }

    // ============================================
    // CONNECTION INFO
    // ============================================

    getConnectionInfo() {
        return {
            online: this.isOnline,
            type: this.connectionType,
            effectiveType: this.effectiveType,
            rtt: this.rtt,
            downlink: this.downlink,
            saveData: this.saveData
        };
    }

    getNetworkQuality() {
        return this.quality.getSummary();
    }

    getNetworkStatus() {
        return {
            ...this.getConnectionInfo(),
            quality: this.getNetworkQuality()
        };
    }

    // ============================================
    // UTILITY METHODS
    // ============================================

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
// NETWORK MONITOR UI COMPONENT
// ============================================

class NetworkMonitorUI {
    constructor(monitor) {
        this.monitor = monitor;
        this.init();
    }

    init() {
        this.createUI();
        this.bindEvents();
        this.startUpdates();
        NetworkMonitorConfig.debug && console.log('[NetworkMonitorUI] Initialized');
    }

    createUI() {
        const container = document.getElementById('network-monitor-container');
        if (!container) return;

        container.innerHTML = `
            <div class="network-monitor-panel">
                <div class="network-header">
                    <i class="fas fa-network-wired"></i>
                    <h3>Network Status</h3>
                    <span class="network-status" id="network-status">${this.monitor.isOnline ? 'Online' : 'Offline'}</span>
                </div>
                
                <div class="network-quality">
                    <div class="quality-indicator" id="quality-indicator">
                        <div class="quality-circle"></div>
                        <span class="quality-label" id="quality-label">Unknown</span>
                    </div>
                </div>
                
                <div class="network-metrics">
                    <div class="metric">
                        <i class="fas fa-tachometer-alt"></i>
                        <div class="metric-info">
                            <span class="metric-label">Latency</span>
                            <span class="metric-value" id="latency-value">-- ms</span>
                        </div>
                    </div>
                    <div class="metric">
                        <i class="fas fa-waveform"></i>
                        <div class="metric-info">
                            <span class="metric-label">Jitter</span>
                            <span class="metric-value" id="jitter-value">-- ms</span>
                        </div>
                    </div>
                    <div class="metric">
                        <i class="fas fa-tachometer-alt"></i>
                        <div class="metric-info">
                            <span class="metric-label">Packet Loss</span>
                            <span class="metric-value" id="packet-loss-value">--%</span>
                        </div>
                    </div>
                    <div class="metric">
                        <i class="fas fa-download"></i>
                        <div class="metric-info">
                            <span class="metric-label">Download</span>
                            <span class="metric-value" id="download-value">-- Mbps</span>
                        </div>
                    </div>
                    <div class="metric">
                        <i class="fas fa-upload"></i>
                        <div class="metric-info">
                            <span class="metric-label">Upload</span>
                            <span class="metric-value" id="upload-value">-- Mbps</span>
                        </div>
                    </div>
                    <div class="metric">
                        <i class="fas fa-signal"></i>
                        <div class="metric-info">
                            <span class="metric-label">Connection</span>
                            <span class="metric-value" id="connection-type">${this.monitor.connectionType || 'Unknown'}</span>
                        </div>
                    </div>
                </div>
                
                <div class="network-history">
                    <h4>Latency History</h4>
                    <canvas id="latency-chart" width="100%" height="100"></canvas>
                </div>
            </div>
        `;

        this.cacheElements();
        this.createChart();
    }

    cacheElements() {
        this.statusSpan = document.getElementById('network-status');
        this.qualityLabel = document.getElementById('quality-label');
        this.qualityCircle = document.querySelector('.quality-circle');
        this.latencyValue = document.getElementById('latency-value');
        this.jitterValue = document.getElementById('jitter-value');
        this.packetLossValue = document.getElementById('packet-loss-value');
        this.downloadValue = document.getElementById('download-value');
        this.uploadValue = document.getElementById('upload-value');
        this.connectionTypeSpan = document.getElementById('connection-type');
    }

    createChart() {
        const canvas = document.getElementById('latency-chart');
        if (!canvas || !window.Chart) return;
        
        this.latencyChart = new Chart(canvas, {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: 'Latency (ms)',
                    data: [],
                    borderColor: '#4361ee',
                    backgroundColor: 'rgba(67, 97, 238, 0.1)',
                    tension: 0.4,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: { mode: 'index', intersect: false }
                },
                scales: {
                    y: { beginAtZero: true, title: { display: true, text: 'Latency (ms)' } },
                    x: { title: { display: true, text: 'Time' } }
                }
            }
        });
    }

    bindEvents() {
        this.monitor.addEventListener('online', () => this.updateStatus(true));
        this.monitor.addEventListener('offline', () => this.updateStatus(false));
        this.monitor.addEventListener('ping_update', (data) => this.updateLatency(data.latency, data.jitter));
        this.monitor.addEventListener('bandwidth_update', (data) => this.updateBandwidth(data.down, data.up));
        this.monitor.addEventListener('quality_update', (data) => this.updateQuality(data.summary));
    }

    startUpdates() {
        // Initial update
        this.updateMetrics();
        
        // Update every second
        setInterval(() => this.updateMetrics(), 1000);
    }

    updateStatus(online) {
        if (this.statusSpan) {
            this.statusSpan.textContent = online ? 'Online' : 'Offline';
            this.statusSpan.className = `network-status ${online ? 'online' : 'offline'}`;
        }
    }

    updateLatency(latency, jitter) {
        if (this.latencyValue) {
            this.latencyValue.textContent = `${Math.round(latency)} ms`;
        }
        if (this.jitterValue) {
            this.jitterValue.textContent = `${Math.round(jitter)} ms`;
        }
        
        // Update chart
        if (this.latencyChart) {
            const now = new Date().toLocaleTimeString();
            this.latencyChart.data.labels.push(now);
            this.latencyChart.data.datasets[0].data.push(Math.round(latency));
            
            if (this.latencyChart.data.labels.length > 20) {
                this.latencyChart.data.labels.shift();
                this.latencyChart.data.datasets[0].data.shift();
            }
            
            this.latencyChart.update();
        }
    }

    updateBandwidth(down, up) {
        if (this.downloadValue) {
            this.downloadValue.textContent = this.formatBandwidth(down);
        }
        if (this.uploadValue) {
            this.uploadValue.textContent = this.formatBandwidth(up);
        }
    }

    updateQuality(summary) {
        if (this.qualityLabel) {
            this.qualityLabel.textContent = summary.label;
        }
        if (this.qualityCircle) {
            this.qualityCircle.style.backgroundColor = summary.color;
        }
        
        if (this.packetLossValue) {
            this.packetLossValue.textContent = `${summary.packetLoss.current}%`;
        }
    }

    updateMetrics() {
        const connection = this.monitor.getConnectionInfo();
        if (this.connectionTypeSpan) {
            this.connectionTypeSpan.textContent = connection.effectiveType || connection.type || 'Unknown';
        }
    }

    formatBandwidth(bps) {
        if (bps >= 1e6) return `${(bps / 1e6).toFixed(1)} Mbps`;
        if (bps >= 1e3) return `${(bps / 1e3).toFixed(1)} Kbps`;
        return `${bps} bps`;
    }
}

// ============================================
// CSS STYLES (Auto-injected)
// ============================================

const networkMonitorStyles = `
    .network-monitor-panel {
        background: var(--bg-card);
        border-radius: 12px;
        padding: 20px;
        border: 1px solid var(--border-color);
    }
    
    .network-header {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 20px;
        padding-bottom: 12px;
        border-bottom: 1px solid var(--border-color);
    }
    
    .network-header i {
        font-size: 20px;
        color: var(--primary);
    }
    
    .network-header h3 {
        flex: 1;
        margin: 0;
    }
    
    .network-status {
        padding: 4px 12px;
        border-radius: 20px;
        font-size: 12px;
        font-weight: 500;
    }
    
    .network-status.online {
        background: var(--success-soft);
        color: var(--success);
    }
    
    .network-status.offline {
        background: var(--danger-soft);
        color: var(--danger);
    }
    
    .network-quality {
        text-align: center;
        margin-bottom: 20px;
    }
    
    .quality-indicator {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 8px;
    }
    
    .quality-circle {
        width: 60px;
        height: 60px;
        border-radius: 50%;
        background: var(--text-muted);
        transition: background-color 0.3s ease;
    }
    
    .quality-label {
        font-size: 14px;
        font-weight: 500;
    }
    
    .network-metrics {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 16px;
        margin-bottom: 20px;
    }
    
    .metric {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 12px;
        background: var(--bg-secondary);
        border-radius: 8px;
    }
    
    .metric i {
        font-size: 20px;
        color: var(--primary);
        width: 32px;
        text-align: center;
    }
    
    .metric-info {
        flex: 1;
    }
    
    .metric-label {
        display: block;
        font-size: 11px;
        color: var(--text-muted);
        margin-bottom: 4px;
    }
    
    .metric-value {
        display: block;
        font-size: 14px;
        font-weight: 500;
        color: var(--text-primary);
    }
    
    .network-history {
        margin-top: 20px;
        padding-top: 20px;
        border-top: 1px solid var(--border-color);
    }
    
    .network-history h4 {
        margin-bottom: 12px;
    }
    
    #latency-chart {
        height: 150px;
        width: 100%;
    }
`;

// Inject styles
if (typeof document !== 'undefined') {
    const styleSheet = document.createElement('style');
    styleSheet.textContent = networkMonitorStyles;
    document.head.appendChild(styleSheet);
}

// ============================================
// CREATE SINGLETON INSTANCES
// ============================================

const networkMonitor = new NetworkMonitor();
const networkMonitorUI = new NetworkMonitorUI(networkMonitor);

// ============================================
// EXPORTS
// ============================================

// Expose to window
window.networkMonitor = networkMonitor;
window.networkMonitorUI = networkMonitorUI;
window.NetworkMonitor = NetworkMonitor;
window.NetworkMonitorConfig = NetworkMonitorConfig;

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        networkMonitor,
        networkMonitorUI,
        NetworkMonitor,
        NetworkMonitorConfig
    };
}

// ES modules export
export {
    networkMonitor,
    networkMonitorUI,
    NetworkMonitor,
    NetworkMonitorConfig
};