const mongoose = require('mongoose');

const inviteSchema = new mongoose.Schema({
    email: { type: String, required: true, lowercase: true },
    homeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Home', required: true },
    invitedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    role: { type: String, enum: ['admin', 'member', 'guest'], default: 'member' },
    token: { type: String, required: true, unique: true },
    status: { type: String, enum: ['pending', 'accepted', 'declined', 'expired'], default: 'pending' },
    expiresAt: { type: Date, required: true },
    acceptedAt: { type: Date },
    declinedAt: { type: Date },
    createdAt: { type: Date, default: Date.now }
});

inviteSchema.index({ token: 1 });
inviteSchema.index({ email: 1, status: 1 });
inviteSchema.index({ homeId: 1, status: 1 });
inviteSchema.index({ expiresAt: 1 });

module.exports = mongoose.model('Invite', inviteSchema);