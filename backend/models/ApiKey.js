const mongoose = require('mongoose');
const crypto = require('crypto');

const apiKeySchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true },
    key: { type: String, required: true, unique: true },
    secret: { type: String, required: true },
    permissions: [{ type: String, enum: ['read', 'write', 'delete', 'admin'], default: ['read'] }],
    lastUsed: { type: Date },
    expiresAt: { type: Date },
    isActive: { type: Boolean, default: true },
    createdAt: { type: Date, default: Date.now }
});

apiKeySchema.methods.generateSecret = function() {
    this.secret = crypto.randomBytes(32).toString('hex');
    return this.secret;
};

apiKeySchema.index({ key: 1 });
apiKeySchema.index({ userId: 1, isActive: 1 });

module.exports = mongoose.model('ApiKey', apiKeySchema);