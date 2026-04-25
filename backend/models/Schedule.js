const mongoose = require('mongoose');

const scheduleSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    deviceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Device', required: true },
    time: { type: String, required: true, match: /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/ },
    days: [{ type: Number, min: 0, max: 6 }],
    action: { type: String, enum: ['on', 'off', 'toggle'], required: true },
    enabled: { type: Boolean, default: true },
    lastRun: { type: Date },
    nextRun: { type: Date },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
}, { timestamps: true });

scheduleSchema.index({ userId: 1 });
scheduleSchema.index({ deviceId: 1 });
scheduleSchema.index({ enabled: 1, nextRun: 1 });

module.exports = mongoose.model('Schedule', scheduleSchema);