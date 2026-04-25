/**
 * ESTIF HOME ULTIMATE - WEBHOOK SERVICE
 * Webhook delivery service for external integrations
 * Version: 2.0.0
 */

const axios = require('axios');
const crypto = require('crypto');
const Webhook = require('../../models/Webhook');
const WebhookDelivery = require('../../models/WebhookDelivery');
const { logger } = require('../../utils/logger');

class WebhookService {
    constructor() {
        this.queue = [];
        this.isProcessing = false;
        this.deliveryQueue = [];
    }

    async deliverWebhook(webhookId, event, payload) {
        try {
            const webhook = await Webhook.findById(webhookId);
            if (!webhook || !webhook.isActive) {
                return { success: false, error: 'Webhook not found or inactive' };
            }

            if (!webhook.events.includes(event) && !webhook.events.includes('*')) {
                return { success: false, error: 'Event not subscribed' };
            }

            const delivery = await WebhookDelivery.create({
                webhookId: webhook._id,
                event,
                payload,
                status: 'pending',
                attemptCount: 0,
                createdAt: Date.now()
            });

            this.queueDelivery(delivery, webhook);
            return { success: true, deliveryId: delivery._id };
        } catch (error) {
            logger.error(`Webhook delivery failed: ${error.message}`);
            return { success: false, error: error.message };
        }
    }

    queueDelivery(delivery, webhook) {
        this.deliveryQueue.push({ delivery, webhook });
        this.processQueue();
    }

    async processQueue() {
        if (this.isProcessing || this.deliveryQueue.length === 0) return;
        
        this.isProcessing = true;

        while (this.deliveryQueue.length > 0) {
            const { delivery, webhook } = this.deliveryQueue.shift();
            await this.sendDelivery(delivery, webhook);
        }

        this.isProcessing = false;
    }

    async sendDelivery(delivery, webhook) {
        let attempt = 0;
        let success = false;
        let response = null;
        let error = null;

        while (attempt < webhook.retryCount && !success) {
            attempt++;
            delivery.attemptCount = attempt;

            try {
                const signature = this.generateSignature(webhook.secret, delivery.payload);
                
                const result = await axios.post(webhook.url, delivery.payload, {
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Webhook-Signature': signature,
                        'X-Webhook-Event': delivery.event,
                        'X-Webhook-Delivery': delivery._id.toString(),
                        'X-Webhook-Attempt': attempt
                    },
                    timeout: webhook.timeout || 5000
                });

                success = true;
                response = {
                    status: result.status,
                    data: result.data
                };

                delivery.status = 'success';
                delivery.completedAt = Date.now();
                delivery.response = response;
                
                logger.info(`Webhook ${delivery._id} delivered successfully`);
            } catch (err) {
                error = {
                    message: err.message,
                    status: err.response?.status,
                    data: err.response?.data
                };
                
                delivery.status = 'failed';
                delivery.error = error;
                
                logger.error(`Webhook ${delivery._id} attempt ${attempt} failed: ${err.message}`);
                
                if (attempt < webhook.retryCount) {
                    await this.delay(Math.pow(2, attempt) * 1000);
                }
            }
        }

        delivery.completedAt = Date.now();
        await delivery.save();

        return { success, response, error };
    }

    generateSignature(secret, payload) {
        if (!secret) return null;
        
        const hmac = crypto.createHmac('sha256', secret);
        hmac.update(JSON.stringify(payload));
        return hmac.digest('hex');
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async testWebhook(webhookId) {
        const testPayload = {
            event: 'test',
            timestamp: Date.now(),
            message: 'Webhook test payload'
        };
        
        return this.deliverWebhook(webhookId, 'test', testPayload);
    }

    async getDeliveryStatus(deliveryId) {
        return WebhookDelivery.findById(deliveryId);
    }

    async getWebhookDeliveries(webhookId, limit = 50) {
        return WebhookDelivery.find({ webhookId })
            .sort({ createdAt: -1 })
            .limit(limit);
    }

    async retryFailedDelivery(deliveryId) {
        const delivery = await WebhookDelivery.findById(deliveryId);
        if (!delivery || delivery.status !== 'failed') {
            return { success: false, error: 'Delivery not found or not failed' };
        }

        const webhook = await Webhook.findById(delivery.webhookId);
        if (!webhook) {
            return { success: false, error: 'Webhook not found' };
        }

        delivery.attemptCount = 0;
        delivery.status = 'pending';
        await delivery.save();

        this.queueDelivery(delivery, webhook);
        return { success: true };
    }

    async getWebhookStats(webhookId) {
        const stats = await WebhookDelivery.aggregate([
            { $match: { webhookId: webhookId } },
            { $group: {
                _id: '$status',
                count: { $sum: 1 }
            }}
        ]);

        const total = stats.reduce((sum, s) => sum + s.count, 0);
        const successCount = stats.find(s => s._id === 'success')?.count || 0;
        const successRate = total > 0 ? (successCount / total * 100).toFixed(2) : 0;

        return {
            total,
            success: successCount,
            failed: stats.find(s => s._id === 'failed')?.count || 0,
            pending: stats.find(s => s._id === 'pending')?.count || 0,
            successRate: `${successRate}%`
        };
    }
}

module.exports = new WebhookService();