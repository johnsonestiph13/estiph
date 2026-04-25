/**
 * ESTIF HOME ULTIMATE - LOGGING SERVICE
 * Centralized logging with multiple transports
 * Version: 2.0.0
 */

const winston = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');
const path = require('path');
const { logger: appLogger } = require('../../utils/logger');

class LoggingService {
    constructor() {
        this.logger = null;
        this.logDir = path.join(__dirname, '../../../logs');
        this.initLogger();
    }

    initLogger() {
        const logFormat = winston.format.combine(
            winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
            winston.format.errors({ stack: true }),
            winston.format.splat(),
            winston.format.json()
        );
        
        const consoleFormat = winston.format.combine(
            winston.format.colorize(),
            winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
            winston.format.printf(({ timestamp, level, message, ...meta }) => {
                return `${timestamp} [${level}]: ${message} ${Object.keys(meta).length ? JSON.stringify(meta) : ''}`;
            })
        );
        
        this.logger = winston.createLogger({
            level: process.env.LOG_LEVEL || 'info',
            format: logFormat,
            transports: [
                new winston.transports.Console({ format: consoleFormat }),
                new DailyRotateFile({
                    filename: path.join(this.logDir, 'application-%DATE%.log'),
                    datePattern: 'YYYY-MM-DD',
                    maxSize: '20m',
                    maxFiles: '30d',
                    format: logFormat
                }),
                new DailyRotateFile({
                    filename: path.join(this.logDir, 'error-%DATE%.log'),
                    datePattern: 'YYYY-MM-DD',
                    level: 'error',
                    maxSize: '20m',
                    maxFiles: '90d',
                    format: logFormat
                })
            ]
        });
    }

    info(message, meta = {}) {
        this.logger.info(message, meta);
        appLogger.info(message, meta);
    }

    error(message, meta = {}) {
        this.logger.error(message, meta);
        appLogger.error(message, meta);
    }

    warn(message, meta = {}) {
        this.logger.warn(message, meta);
        appLogger.warn(message, meta);
    }

    debug(message, meta = {}) {
        this.logger.debug(message, meta);
        appLogger.debug(message, meta);
    }

    http(message, meta = {}) {
        this.logger.http(message, meta);
    }

    logRequest(req, res, duration) {
        this.http(`${req.method} ${req.url} ${res.statusCode} - ${duration}ms`, {
            method: req.method,
            url: req.url,
            status: res.statusCode,
            duration,
            ip: req.ip,
            userAgent: req.headers['user-agent'],
            userId: req.user?._id
        });
    }

    logError(err, req = null) {
        const errorMeta = {
            message: err.message,
            stack: err.stack,
            name: err.name
        };
        
        if (req) {
            errorMeta.method = req.method;
            errorMeta.url = req.url;
            errorMeta.ip = req.ip;
            errorMeta.userId = req.user?._id;
        }
        
        this.error(err.message, errorMeta);
    }

    logSecurity(event, userId, details = {}) {
        this.warn(`Security Event: ${event}`, {
            event,
            userId,
            details,
            timestamp: new Date().toISOString()
        });
    }

    logBusiness(event, userId, data = {}) {
        this.info(`Business Event: ${event}`, {
            event,
            userId,
            data,
            timestamp: new Date().toISOString()
        });
    }

    getLogFiles() {
        const fs = require('fs');
        if (!fs.existsSync(this.logDir)) return [];
        
        return fs.readdirSync(this.logDir)
            .filter(f => f.endsWith('.log'))
            .map(f => ({ name: f, path: path.join(this.logDir, f) }));
    }

    async searchLogs(query, limit = 100) {
        // Implementation would search through log files
        // For now, return empty array
        return [];
    }

    flush() {
        return new Promise((resolve) => {
            this.logger.on('finish', resolve);
            this.logger.end();
        });
    }
}

module.exports = new LoggingService();