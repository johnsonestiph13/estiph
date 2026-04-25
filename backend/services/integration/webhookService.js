/**
 * ESTIF HOME ULTIMATE - WEBHOOK SERVICE
 * Outgoing webhook delivery for third-party integrations
 * Version: 2.0.0
 */

const axios = require('axios');
const crypto = require('crypto');
const Webhook = require('../../models/Webhook');
const WebhookDelivery = require('../../models/WebhookDelivery');
const { logger } = require('../../utils/logger');

class WebhookIntegrationService {
    async triggerWebhook(webhookId, event, payload) {
        const webhook = await Webhook.findById(webhookId);
        if (!webhook || !webhook.isActive) return;
        
        if (!webhook.events.includes(event)) return;
        
        const signature = this.generateSignature(webhook.secret, payload);
        const delivery = await WebhookDelivery.create({
            webhookId, event, payload, status: 'pending', attemptCount: 0
        });
        
        this.deliver(delivery, webhook);
        return delivery;
    }

    generateSignature(secret, payload) {
        if (!secret) return null;
        return crypto.createHmac('sha256', secret).update(JSON.stringify(payload)).digest('hex');
    }

    async deliver(delivery, webhook) {
        let attempt = 0;
        let success = false;
        
        while (attempt < webhook.retryCount && !success) {
            attempt++;
            delivery.attemptCount = attempt;
            
            try {
                const response = await axios.post(webhook.url, delivery.payload, {
                    headers: { 'X-Webhook-Signature': this.generateSignature(webhook.secret, delivery.payload) },
                    timeout: webhook.timeout || 5000
                });
                
                success = true;
                delivery.status = 'success';
                delivery.response = { status: response.status, data: response.data };
                logger.info(`Webhook ${delivery._id} delivered`);
            } catch (error) {
                delivery.error = { message: error.message, status: error.response?.status };
                logger.error(`Webhook ${delivery._id} attempt ${attempt} failed`);
                
                if (attempt < webhook.retryCount) {
                    await this.delay(Math.pow(2, attempt) * 1000);
                }
            }
        }
        
        delivery.completedAt = new Date();
        await delivery.save();
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

module.exports = new WebhookIntegrationService();