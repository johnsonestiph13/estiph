const mongoose = require('mongoose');

const activityLogSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    homeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Home' },
    deviceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Device' },
    action: { type: String, required: true, index: true },
    entityType: { type: String, enum: ['user', 'home', 'device', 'automation', 'schedule', 'scene', 'settings'] },
    entityId: { type: String },
    details: { type: mongoose.Schema.Types.Mixed, default: {} },
    ip: { type: String },
    userAgent: { type: String },
    status: { type: String, enum: ['success', 'failed', 'pending'], default: 'success' },
    duration: { type: Number },
    createdAt: { type: Date, default: Date.now, index: true }
});

activityLogSchema.index({ userId: 1, createdAt: -1 });
activityLogSchema.index({ homeId: 1, createdAt: -1 });
activityLogSchema.index({ action: 1, createdAt: -1 });
activityLogSchema.index({ createdAt: -1 });

module.exports = mongoose.model('ActivityLog', activityLogSchema);