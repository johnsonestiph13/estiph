/**
 * ESTIF HOME ULTIMATE - TRACING SERVICE
 * Distributed tracing for request tracking
 * Version: 2.0.0
 */

const crypto = require('crypto');
const { logger } = require('../../utils/logger');

class TracingService {
    constructor() {
        this.traces = new Map();
        this.maxTraces = 1000;
    }

    generateTraceId() {
        return crypto.randomBytes(16).toString('hex');
    }

    generateSpanId() {
        return crypto.randomBytes(8).toString('hex');
    }

    startTrace(name, metadata = {}) {
        const traceId = this.generateTraceId();
        const spanId = this.generateSpanId();
        
        const trace = {
            id: traceId,
            name,
            startTime: Date.now(),
            spans: [{
                id: spanId,
                name,
                startTime: Date.now(),
                metadata
            }],
            metadata
        };
        
        this.traces.set(traceId, trace);
        this.cleanupOldTraces();
        
        return { traceId, spanId };
    }

    addSpan(traceId, name, metadata = {}) {
        const trace = this.traces.get(traceId);
        if (!trace) return null;
        
        const spanId = this.generateSpanId();
        
        trace.spans.push({
            id: spanId,
            name,
            startTime: Date.now(),
            metadata
        });
        
        return spanId;
    }

    endSpan(traceId, spanId, error = null) {
        const trace = this.traces.get(traceId);
        if (!trace) return false;
        
        const span = trace.spans.find(s => s.id === spanId);
        if (span) {
            span.endTime = Date.now();
            span.duration = span.endTime - span.startTime;
            if (error) span.error = error;
        }
        
        return true;
    }

    endTrace(traceId, error = null) {
        const trace = this.traces.get(traceId);
        if (!trace) return false;
        
        trace.endTime = Date.now();
        trace.duration = trace.endTime - trace.startTime;
        if (error) trace.error = error;
        
        this.logTrace(trace);
        
        return true;
    }

    logTrace(trace) {
        logger.info(`Trace ${trace.id} completed in ${trace.duration}ms`);
        
        for (const span of trace.spans) {
            if (span.duration) {
                logger.debug(`  Span ${span.name}: ${span.duration}ms`);
            }
        }
    }

    getTrace(traceId) {
        return this.traces.get(traceId);
    }

    cleanupOldTraces() {
        if (this.traces.size > this.maxTraces) {
            const toDelete = this.traces.size - this.maxTraces;
            const keys = Array.from(this.traces.keys());
            for (let i = 0; i < toDelete; i++) {
                this.traces.delete(keys[i]);
            }
        }
    }

    async traceRequest(req, res, next) {
        const traceId = req.headers['x-trace-id'] || this.generateTraceId();
        const spanId = this.generateSpanId();
        
        req.traceId = traceId;
        req.spanId = spanId;
        
        res.setHeader('X-Trace-Id', traceId);
        
        const startTime = Date.now();
        
        res.on('finish', () => {
            const duration = Date.now() - startTime;
            logger.info(`Request ${req.method} ${req.url} completed in ${duration}ms (trace: ${traceId})`);
            
            this.addSpan(traceId, `${req.method} ${req.url}`, {
                status: res.statusCode,
                duration
            });
        });
        
        next();
    }

    getTraces() {
        return Array.from(this.traces.values()).map(trace => ({
            id: trace.id,
            name: trace.name,
            duration: trace.duration,
            spanCount: trace.spans.length,
            startTime: trace.startTime
        }));
    }

    clearTraces() {
        this.traces.clear();
        return true;
    }
}

module.exports = new TracingService();