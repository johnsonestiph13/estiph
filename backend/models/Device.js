const mongoose = require('mongoose');

const deviceSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    nameAm: { type: String, trim: true },
    type: { type: String, required: true, enum: ['light', 'fan', 'ac', 'tv', 'heater', 'pump', 'sensor', 'camera', 'lock', 'speaker', 'blind'] },
    room: { type: String, default: '' },
    roomAm: { type: String, default: '' },
    gpio: { type: Number, min: 0, max: 39, default: null },
    power: { type: Number, default: 0 },
    state: { type: Boolean, default: false },
    autoMode: { type: Boolean, default: false },
    online: { type: Boolean, default: true },
    ip: { type: String, default: '' },
    mac: { type: String, default: '' },
    firmwareVersion: { type: String, default: '1.0.0' },
    homeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Home', default: null },
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
    tags: [{ type: String }],
    lastSeen: { type: Date, default: Date.now },
    lastStateChange: { type: Date, default: Date.now },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
}, { timestamps: true });

deviceSchema.index({ ownerId: 1 });
deviceSchema.index({ homeId: 1 });
deviceSchema.index({ type: 1 });
deviceSchema.index({ room: 1 });
deviceSchema.index({ online: 1 });

module.exports = mongoose.model('Device', deviceSchema);