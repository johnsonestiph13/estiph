/**
 * ESTIF HOME ULTIMATE - METRICS SERVICE
 * System metrics collection and monitoring
 * Version: 2.0.0
 */

const os = require('os');
const client = require('prom-client');
const { logger } = require('../../utils/logger');

class MetricsService {
    constructor() {
        this.collectInterval = null;
        this.metrics = new Map();
        this.register = new client.Registry();
        this.initMetrics();
    }

    initMetrics() {
        // CPU Metrics
        this.cpuUsage = new client.Gauge({ name: 'cpu_usage_percent', help: 'CPU usage percentage', registers: [this.register] });
        this.cpuCores = new client.Gauge({ name: 'cpu_cores_total', help: 'Total CPU cores', registers: [this.register] });
        
        // Memory Metrics
        this.memoryTotal = new client.Gauge({ name: 'memory_total_bytes', help: 'Total memory in bytes', registers: [this.register] });
        this.memoryFree = new client.Gauge({ name: 'memory_free_bytes', help: 'Free memory in bytes', registers: [this.register] });
        this.memoryUsed = new client.Gauge({ name: 'memory_used_bytes', help: 'Used memory in bytes', registers: [this.register] });
        
        // Process Metrics
        this.processCpu = new client.Gauge({ name: 'process_cpu_usage_percent', help: 'Process CPU usage', registers: [this.register] });
        this.processMemory = new client.Gauge({ name: 'process_memory_bytes', help: 'Process memory usage', registers: [this.register] });
        this.processUptime = new client.Gauge({ name: 'process_uptime_seconds', help: 'Process uptime', registers: [this.register] });
        
        // Request Metrics
        this.requestTotal = new client.Counter({ name: 'http_requests_total', help: 'Total HTTP requests', labelNames: ['method', 'path', 'status'], registers: [this.register] });
        this.requestDuration = new client.Histogram({ name: 'http_request_duration_seconds', help: 'HTTP request duration', buckets: [0.1, 0.5, 1, 2, 5], registers: [this.register] });
        this.activeRequests = new client.Gauge({ name: 'http_active_requests', help: 'Active HTTP requests', registers: [this.register] });
        
        // Database Metrics
        this.dbQueryDuration = new client.Histogram({ name: 'db_query_duration_seconds', help: 'Database query duration', buckets: [0.01, 0.05, 0.1, 0.5, 1], registers: [this.register] });
        this.dbConnections = new client.Gauge({ name: 'db_connections', help: 'Database connections', registers: [this.register] });
        
        // Business Metrics
        this.activeDevices = new client.Gauge({ name: 'active_devices_total', help: 'Total active devices', registers: [this.register] });
        this.usersTotal = new client.Gauge({ name: 'users_total', help: 'Total users', registers: [this.register] });
        this.automationTriggers = new client.Counter({ name: 'automation_triggers_total', help: 'Total automation triggers', registers: [this.register] });
        
        // Set static values
        this.cpuCores.set(os.cpus().length);
        this.memoryTotal.set(os.totalmem());
    }

    startCollection(interval = 15000) {
        if (this.collectInterval) clearInterval(this.collectInterval);
        
        this.collectInterval = setInterval(() => {
            this.collectSystemMetrics();
        }, interval);
        
        logger.info('Metrics collection started');
    }

    collectSystemMetrics() {
        const cpus = os.cpus();
        let idle = 0, total = 0;
        
        for (const cpu of cpus) {
            for (const type in cpu.times) {
                total += cpu.times[type];
            }
            idle += cpu.times.idle;
        }
        
        const cpuPercent = 100 - (idle / total * 100);
        this.cpuUsage.set(cpuPercent);
        
        const freeMem = os.freemem();
        const usedMem = os.totalmem() - freeMem;
        this.memoryFree.set(freeMem);
        this.memoryUsed.set(usedMem);
        
        const processCpuUsage = process.cpuUsage();
        const processCpuPercent = (processCpuUsage.user + processCpuUsage.system) / 1000000;
        this.processCpu.set(processCpuPercent);
        this.processMemory.set(process.memoryUsage().rss);
        this.processUptime.set(process.uptime());
    }

    recordRequest(method, path, status, duration) {
        this.requestTotal.inc({ method, path, status });
        this.requestDuration.observe(duration);
    }

    incrementActiveRequests() {
        this.activeRequests.inc();
    }

    decrementActiveRequests() {
        this.activeRequests.dec();
    }

    recordDbQuery(duration) {
        this.dbQueryDuration.observe(duration);
    }

    setDbConnections(count) {
        this.dbConnections.set(count);
    }

    setActiveDevices(count) {
        this.activeDevices.set(count);
    }

    setUsersTotal(count) {
        this.usersTotal.set(count);
    }

    incrementAutomationTriggers() {
        this.automationTriggers.inc();
    }

    async getMetrics() {
        return this.register.metrics();
    }

    async getMetricsJSON() {
        const metrics = {};
        const metricNames = ['cpu_usage_percent', 'memory_used_bytes', 'http_requests_total', 'active_devices_total'];
        
        for (const name of metricNames) {
            const metric = this.register.getSingleMetric(name);
            if (metric) {
                const values = metric.get();
                metrics[name] = values.values;
            }
        }
        
        return metrics;
    }

    stopCollection() {
        if (this.collectInterval) {
            clearInterval(this.collectInterval);
            this.collectInterval = null;
            logger.info('Metrics collection stopped');
        }
    }
}

module.exports = new MetricsService();