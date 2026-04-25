const mongoose = require('mongoose');

const sessionSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    token: { type: String, required: true, unique: true },
    refreshToken: { type: String },
    ipAddress: { type: String },
    userAgent: { type: String },
    deviceName: { type: String },
    deviceType: { type: String, enum: ['mobile', 'tablet', 'desktop', 'tv', 'unknown'], default: 'unknown' },
    isActive: { type: Boolean, default: true },
    lastUsed: { type: Date, default: Date.now },
    expiresAt: { type: Date, required: true },
    createdAt: { type: Date, default: Date.now }
});

sessionSchema.index({ userId: 1, isActive: 1 });
sessionSchema.index({ token: 1 });
sessionSchema.index({ expiresAt: 1 });

module.exports = mongoose.model('Session', sessionSchema);