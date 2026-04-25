const mongoose = require('mongoose');

const automationSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    nameAm: { type: String, trim: true },
    description: { type: String, default: '' },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    homeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Home' },
    trigger: {
        type: { type: String, enum: ['schedule', 'temperature', 'humidity', 'motion', 'device_state', 'time', 'sunrise', 'sunset', 'voice', 'manual'], required: true },
        config: { type: mongoose.Schema.Types.Mixed, required: true }
    },
    condition: {
        type: { type: String, enum: ['temperature', 'humidity', 'device_state', 'time', 'none'], default: 'none' },
        config: { type: mongoose.Schema.Types.Mixed, default: {} }
    },
    action: {
        type: { type: String, enum: ['device_on', 'device_off', 'device_toggle', 'scene_activate', 'notification', 'webhook', 'delay'], required: true },
        config: { type: mongoose.Schema.Types.Mixed, required: true }
    },
    enabled: { type: Boolean, default: true },
    priority: { type: Number, default: 0 },
    cooldown: { type: Number, default: 0 },
    lastTriggered: { type: Date },
    triggerCount: { type: Number, default: 0 },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
}, { timestamps: true });

automationSchema.index({ userId: 1 });
automationSchema.index({ homeId: 1 });
automationSchema.index({ enabled: 1 });
automationSchema.index({ triggerCount: -1 });

module.exports = mongoose.model('Automation', automationSchema);