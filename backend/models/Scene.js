const mongoose = require('mongoose');

const sceneSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    nameAm: { type: String, trim: true },
    description: { type: String, default: '' },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    homeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Home' },
    icon: { type: String, default: '✨' },
    color: { type: String, default: '#4361ee' },
    deviceStates: { type: mongoose.Schema.Types.Mixed, default: {} },
    transitionTime: { type: Number, default: 500 },
    isActive: { type: Boolean, default: false },
    order: { type: Number, default: 0 },
    tags: [{ type: String }],
    schedule: {
        enabled: { type: Boolean, default: false },
        time: { type: String },
        days: [{ type: Number }]
    },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
}, { timestamps: true });

sceneSchema.index({ userId: 1 });
sceneSchema.index({ homeId: 1 });
sceneSchema.index({ order: 1 });

module.exports = mongoose.model('Scene', sceneSchema);