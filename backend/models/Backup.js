const mongoose = require('mongoose');

const backupSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true },
    description: { type: String, default: '' },
    size: { type: Number, default: 0 },
    type: { type: String, enum: ['full', 'partial'], default: 'full' },
    status: { type: String, enum: ['pending', 'completed', 'failed', 'restored'], default: 'pending' },
    data: { type: mongoose.Schema.Types.Mixed, default: {} },
    filePath: { type: String },
    error: { type: String },
    completedAt: { type: Date },
    restoredAt: { type: Date },
    expiresAt: { type: Date },
    createdAt: { type: Date, default: Date.now }
});

backupSchema.index({ userId: 1, createdAt: -1 });
backupSchema.index({ status: 1 });
backupSchema.index({ expiresAt: 1 });

module.exports = mongoose.model('Backup', backupSchema);