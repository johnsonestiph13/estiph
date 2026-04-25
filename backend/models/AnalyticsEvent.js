const mongoose = require('mongoose');

const analyticsEventSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    sessionId: { type: String, required: true },
    eventType: { type: String, required: true, index: true },
    category: { type: String, required: true },
    action: { type: String, required: true },
    label: { type: String },
    value: { type: Number },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
    page: { type: String },
    referrer: { type: String },
    userAgent: { type: String },
    ip: { type: String },
    timestamp: { type: Date, default: Date.now, index: true }
});

analyticsEventSchema.index({ userId: 1, timestamp: -1 });
analyticsEventSchema.index({ eventType: 1, timestamp: -1 });
analyticsEventSchema.index({ category: 1, action: 1 });
analyticsEventSchema.index({ sessionId: 1, timestamp: -1 });
analyticsEventSchema.index({ timestamp: -1 });

// TTL index to auto-delete events older than 90 days
analyticsEventSchema.index({ timestamp: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

module.exports = mongoose.model('AnalyticsEvent', analyticsEventSchema);