const mongoose = require('mongoose');

const bluetoothDeviceSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    deviceId: { type: String, required: true },
    name: { type: String },
    address: { type: String, required: true, unique: true },
    rssi: { type: Number },
    manufacturerData: { type: mongoose.Schema.Types.Mixed },
    isPaired: { type: Boolean, default: false },
    isConnected: { type: Boolean, default: false },
    services: [{ type: String }],
    characteristics: [{ type: String }],
    batteryLevel: { type: Number, min: 0, max: 100 },
    firmwareVersion: { type: String },
    lastSeen: { type: Date, default: Date.now },
    lastConnected: { type: Date },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
}, { timestamps: true });

bluetoothDeviceSchema.index({ userId: 1, address: 1 });
bluetoothDeviceSchema.index({ userId: 1, isPaired: 1 });
bluetoothDeviceSchema.index({ userId: 1, isConnected: 1 });

module.exports = mongoose.model('BluetoothDevice', bluetoothDeviceSchema);