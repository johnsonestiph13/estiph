const mongoose = require('mongoose');

const voiceCommandSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    phrase: { type: String, required: true },
    action: { type: String, required: true },
    deviceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Device' },
    parameters: { type: mongoose.Schema.Types.Mixed, default: {} },
    language: { type: String, default: 'en' },
    confidence: { type: Number, min: 0, max: 1 },
    isCustom: { type: Boolean, default: false },
    timesUsed: { type: Number, default: 0 },
    lastUsed: { type: Date },
    createdAt: { type: Date, default: Date.now }
});

voiceCommandSchema.index({ userId: 1, phrase: 1 }, { unique: true });
voiceCommandSchema.index({ userId: 1, timesUsed: -1 });
voiceCommandSchema.index({ language: 1 });

module.exports = mongoose.model('VoiceCommand', voiceCommandSchema);