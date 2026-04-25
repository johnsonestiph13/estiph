const mongoose = require('mongoose');

const homeSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    nameAm: { type: String, trim: true },
    address: { type: String, default: '' },
    city: { type: String, default: '' },
    country: { type: String, default: 'Ethiopia' },
    zipCode: { type: String, default: '' },
    location: {
        lat: { type: Number, default: null },
        lng: { type: Number, default: null }
    },
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    members: [{
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        role: { type: String, enum: ['owner', 'admin', 'member', 'guest'], default: 'member' },
        joinedAt: { type: Date, default: Date.now }
    }],
    rooms: [{
        _id: { type: String, auto: true },
        name: { type: String, required: true },
        nameAm: { type: String },
        icon: { type: String, default: '🚪' },
        type: { type: String, default: 'custom' },
        devices: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Device' }],
        createdAt: { type: Date, default: Date.now }
    }],
    settings: {
        timezone: { type: String, default: 'Africa/Addis_Ababa' },
        temperatureUnit: { type: String, enum: ['celsius', 'fahrenheit'], default: 'celsius' },
        language: { type: String, default: 'en' },
        theme: { type: String, default: 'light' }
    },
    isActive: { type: Boolean, default: true },
    isArchived: { type: Boolean, default: false },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
}, { timestamps: true });

homeSchema.index({ ownerId: 1 });
homeSchema.index({ 'members.userId': 1 });
homeSchema.index({ name: 1 });

module.exports = mongoose.model('Home', homeSchema);