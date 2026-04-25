/**
 * Seed 006: Default Settings
 * Creates system-wide settings and configurations
 */

const { ObjectId } = require('mongodb');

async function seed(db) {
    console.log('Seeding default settings...');
    
    const settings = [
        {
            key: "system",
            category: "general",
            values: {
                name: "Estif Home Ultimate",
                version: "3.0.0",
                timezone: "Africa/Addis_Ababa",
                maintenanceMode: false,
                debugMode: false,
                apiRateLimit: 100,
                maxDevicesPerHome: 100,
                maxMembersPerHome: 50
            },
            updatedBy: null,
            updatedAt: new Date(),
            createdAt: new Date()
        },
        {
            key: "security",
            category: "security",
            values: {
                sessionTimeout: 3600, // 1 hour
                maxLoginAttempts: 5,
                lockoutDuration: 900, // 15 minutes
                passwordExpiryDays: 90,
                twoFactorRequired: false,
                    jwtExpiry: "7d",
                refreshTokenExpiry: "30d",
                allowedOrigins: ["https://estif-home.com", "http://localhost:3000"]
            },
            updatedBy: null,
            updatedAt: new Date(),
            createdAt: new Date()
        },
        {
            key: "notifications",
            category: "communication",
            values: {
                emailEnabled: true,
                pushEnabled: true,
                smsEnabled: false,
                emailSettings: {
                    smtpHost: "smtp.gmail.com",
                    smtpPort: 587,
                    fromEmail: "noreply@estif-home.com"
                },
                pushSettings: {
                    vapidPublicKey: "",
                    vapidPrivateKey: ""
                }
            },
            updatedBy: null,
            updatedAt: new Date(),
            createdAt: new Date()
        },
        {
            key: "automation",
            category: "automation",
            values: {
                maxAutomationsPerHome: 50,
                autoBackupEnabled: true,
                autoBackupSchedule: "0 2 * * *", // Daily at 2 AM
                logRetentionDays: 30,
                energyLogRetentionDays: 90,
                deviceHistoryRetentionDays: 30
            },
            updatedBy: null,
            updatedAt: new Date(),
            createdAt: new Date()
        },
        {
            key: "voice",
            category: "ai",
            values: {
                enabled: true,
                wakeWords: ["Hey Estiph", "ሰላም እስቲፍ"],
                language: "en",
                confidenceThreshold: 0.7,
                offlineMode: true
            },
            updatedBy: null,
            updatedAt: new Date(),
            createdAt: new Date()
        },
        {
            key: "bluetooth",
            category: "connectivity",
            values: {
                enabled: true,
                scanInterval: 30, // seconds
                proximityRange: 5, // meters
                autoConnect: true,
                allowedDevices: []
            },
            updatedBy: null,
            updatedAt: new Date(),
            createdAt: new Date()
        },
        {
            key: "energy",
            category: "analytics",
            values: {
                currency: "ETB",
                costPerKwh: 0.65, // Ethiopian Birr
                solarEnabled: false,
                peakHours: {
                    morning: { start: "06:00", end: "09:00" },
                    evening: { start: "18:00", end: "21:00" }
                },
                alertsEnabled: true,
                highUsageThreshold: 5000 // watts
            },
            updatedBy: null,
            updatedAt: new Date(),
            createdAt: new Date()
        },
        {
            key: "pwa",
            category: "frontend",
            values: {
                cacheName: "estif-home-v3",
                offlineEnabled: true,
                syncInterval: 60, // seconds
                themeColors: {
                    light: "#ffffff",
                    dark: "#1a1a1a",
                    primary: "#4361ee"
                }
            },
            updatedBy: null,
            updatedAt: new Date(),
            createdAt: new Date()
        },
        {
            key: "emergency",
            category: "safety",
            values: {
                contacts: [
                    {
                        name: "Estifanos Yohannis",
                        phone: "+251987713787",
                        email: "johnsonestiph01@gmail.com",
                        isPrimary: true
                    },
                    {
                        name: "Emergency Services",
                        phone: "911",
                        isPrimary: false
                    }
                ],
                autoAlert: true,
                alertDelay: 30, // seconds
                smsOnEmergency: true
            },
            updatedBy: null,
            updatedAt: new Date(),
            createdAt: new Date()
        }
    ];
    
    // Insert settings
    const insertedSettings = [];
    for (const setting of settings) {
        const existing = await db.collection('settings').findOne({ key: setting.key });
        if (!existing) {
            const result = await db.collection('settings').insertOne(setting);
            insertedSettings.push({ ...setting, _id: result.insertedId });
            console.log(`Created setting: ${setting.key}`);
        } else {
            insertedSettings.push(existing);
            console.log(`Setting already exists: ${setting.key}`);
        }
    }
    
    return insertedSettings;
}

async function down(db) {
    console.log('Removing seeded settings...');
    await db.collection('settings').deleteMany({
        key: { $in: ['system', 'security', 'notifications', 'automation', 'voice', 'bluetooth', 'energy', 'pwa', 'emergency'] }
    });
}

module.exports = { seed, down };