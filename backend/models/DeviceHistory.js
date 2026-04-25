const mongoose = require('mongoose');

const deviceHistorySchema = new mongoose.Schema({
    deviceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Device', required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    action: { type: String, enum: ['on', 'off', 'toggle', 'auto_on', 'auto_off', 'schedule_on', 'schedule_off', 'voice_on', 'voice_off'], required: true },
    source: { type: String, enum: ['manual', 'auto', 'schedule', 'voice', 'api', 'webhook'], default: 'manual' },
    previousState: { type: Boolean },
    newState: { type: Boolean },
    duration: { type: Number },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
    createdAt: { type: Date, default: Date.now }
});

deviceHistorySchema.index({ deviceId: 1, createdAt: -1 });
deviceHistorySchema.index({ userId: 1, createdAt: -1 });
deviceHistorySchema.index({ createdAt: -1 });

module.exports = mongoose.model('DeviceHistory', deviceHistorySchema);