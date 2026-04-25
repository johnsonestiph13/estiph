const mongoose = require('mongoose');

const energyLogSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    deviceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Device', required: true },
    homeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Home' },
    energyConsumed: { type: Number, required: true },
    power: { type: Number, required: true },
    runtime: { type: Number, required: true },
    cost: { type: Number, default: 0 },
    timestamp: { type: Date, default: Date.now }
});

energyLogSchema.index({ userId: 1, timestamp: -1 });
energyLogSchema.index({ deviceId: 1, timestamp: -1 });
energyLogSchema.index({ homeId: 1, timestamp: -1 });
energyLogSchema.index({ timestamp: -1 });

module.exports = mongoose.model('EnergyLog', energyLogSchema);