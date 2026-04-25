const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    nameAm: { type: String, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, select: false },
    role: { type: String, enum: ['super_admin', 'admin', 'user'], default: 'user' },
    avatar: { type: String, default: '' },
    phone: { type: String, default: '' },
    homes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Home' }],
    isActive: { type: Boolean, default: true },
    isEmailVerified: { type: Boolean, default: false },
    lastLogin: { type: Date },
    settings: {
        language: { type: String, default: 'en' },
        theme: { type: String, default: 'light' },
        notifications: { type: Boolean, default: true },
        twoFactorEnabled: { type: Boolean, default: false },
        twoFactorMethod: { type: String, enum: ['authenticator', 'sms', 'email'], default: null }
    },
    deviceGroups: [{
        id: { type: String },
        name: { type: String },
        deviceIds: [{ type: String }],
        createdAt: { type: Date, default: Date.now },
        updatedAt: { type: Date, default: Date.now }
    }],
    pushSubscription: { type: mongoose.Schema.Types.Mixed, default: null },
    pushEnabled: { type: Boolean, default: false },
    verificationToken: { type: String },
    verificationTokenExpires: { type: Date },
    resetPasswordToken: { type: String },
    resetPasswordExpires: { type: Date },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
}, { timestamps: true });

userSchema.pre('save', async function(next) {
    if (!this.isModified('password')) return next();
    this.password = await bcrypt.hash(this.password, 12);
    next();
});

userSchema.methods.comparePassword = async function(candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.password);
};

userSchema.index({ email: 1 });
userSchema.index({ role: 1 });
userSchema.index({ createdAt: -1 });

module.exports = mongoose.model('User', userSchema);