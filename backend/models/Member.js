const mongoose = require('mongoose');

const memberSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    homeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Home', required: true },
    role: { type: String, enum: ['owner', 'admin', 'member', 'guest'], default: 'member' },
    permissions: [{ type: String }],
    joinedAt: { type: Date, default: Date.now },
    invitedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    isActive: { type: Boolean, default: true },
    settings: {
        notifications: { type: Boolean, default: true },
        emailUpdates: { type: Boolean, default: true }
    },
    lastActive: { type: Date, default: Date.now },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} }
}, { timestamps: true });

memberSchema.index({ userId: 1, homeId: 1 }, { unique: true });
memberSchema.index({ homeId: 1 });
memberSchema.index({ role: 1 });

module.exports = mongoose.model('Member', memberSchema);