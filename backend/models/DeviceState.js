const mongoose = require('mongoose');

const deviceStateSchema = new mongoose.Schema({
    deviceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Device', required: true, unique: true },
    state: { type: Boolean, default: false },
    autoMode: { type: Boolean, default: false },
    brightness: { type: Number, min: 0, max: 100 },
    temperature: { type: Number },
    speed: { type: Number, min: 1, max: 5 },
    color: { type: String },
    volume: { type: Number, min: 0, max: 100 },
    lastCommand: { type: String },
    lastCommandAt: { type: Date },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
    updatedAt: { type: Date, default: Date.now }
}, { timestamps: true });

deviceStateSchema.index({ deviceId: 1 });
deviceStateSchema.index({ updatedAt: -1 });

module.exports = mongoose.model('DeviceState', deviceStateSchema);