const mongoose = require('mongoose');

const webhookSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true },
    url: { type: String, required: true },
    secret: { type: String },
    events: [{ type: String, required: true }],
    headers: { type: mongoose.Schema.Types.Mixed, default: {} },
    retryCount: { type: Number, default: 3 },
    timeout: { type: Number, default: 5000 },
    isActive: { type: Boolean, default: true },
    lastTriggered: { type: Date },
    lastSuccess: { type: Date },
    lastError: { type: String },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
}, { timestamps: true });

webhookSchema.index({ userId: 1, isActive: 1 });
webhookSchema.index({ events: 1 });

module.exports = mongoose.model('Webhook', webhookSchema);