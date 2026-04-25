/**
 * ESTIF HOME ULTIMATE - ALERT SERVICE
 * Alert generation and notification management
 * Version: 2.0.0
 */

const { logger } = require('../../utils/logger');
const { sendPushNotification } = require('../communication/pushService');
const { sendEmail } = require('../communication/emailService');
const { sendSMS } = require('../communication/smsService');

class AlertService {
    constructor() {
        this.alerts = [];
        this.alertThresholds = {
            cpu: 80,
            memory: 85,
            responseTime: 5000,
            errorRate: 5
        };
    }

    async checkSystemHealth(metrics) {
        const alerts = [];
        
        if (metrics.cpu > this.alertThresholds.cpu) {
            alerts.push(this.createAlert('high_cpu', `CPU usage at ${metrics.cpu}%`, 'warning'));
        }
        
        if (metrics.memory > this.alertThresholds.memory) {
            alerts.push(this.createAlert('high_memory', `Memory usage at ${metrics.memory}%`, 'warning'));
        }
        
        if (metrics.responseTime > this.alertThresholds.responseTime) {
            alerts.push(this.createAlert('high_response_time', `Response time ${metrics.responseTime}ms`, 'warning'));
        }
        
        if (metrics.errorRate > this.alertThresholds.errorRate) {
            alerts.push(this.createAlert('high_error_rate', `Error rate at ${metrics.errorRate}%`, 'critical'));
        }
        
        for (const alert of alerts) {
            await this.sendAlert(alert);
        }
        
        return alerts;
    }

    createAlert(type, message, severity = 'info', data = {}) {
        return {
            id: Date.now(),
            type,
            message,
            severity,
            data,
            timestamp: new Date(),
            acknowledged: false
        };
    }

    async sendAlert(alert) {
        logger.info(`Alert: ${alert.type} - ${alert.message} (${alert.severity})`);
        
        if (alert.severity === 'critical') {
            await this.notifyAdmins(alert);
        }
        
        this.alerts.unshift(alert);
        if (this.alerts.length > 1000) this.alerts.pop();
        
        return alert;
    }

    async notifyAdmins(alert) {
        const adminEmails = process.env.ADMIN_EMAILS ? process.env.ADMIN_EMAILS.split(',') : [];
        
        for (const email of adminEmails) {
            await sendEmail({
                to: email,
                subject: `[CRITICAL] Estif Home Alert: ${alert.type}`,
                html: `<h1>System Alert</h1><p>${alert.message}</p><p>Time: ${alert.timestamp}</p>`
            });
        }
    }

    async getActiveAlerts() {
        const oneHourAgo = Date.now() - 60 * 60 * 1000;
        return this.alerts.filter(a => a.timestamp.getTime() > oneHourAgo && !a.acknowledged);
    }

    acknowledgeAlert(alertId) {
        const alert = this.alerts.find(a => a.id === parseInt(alertId));
        if (alert) {
            alert.acknowledged = true;
            return true;
        }
        return false;
    }

    clearAlerts() {
        this.alerts = [];
        return true;
    }

    updateThreshold(metric, value) {
        if (this.alertThresholds.hasOwnProperty(metric)) {
            this.alertThresholds[metric] = value;
            return true;
        }
        return false;
    }

    getThresholds() {
        return { ...this.alertThresholds };
    }
}

module.exports = new AlertService();