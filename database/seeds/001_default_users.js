/**
 * Seed 001: Default Users
 * Creates admin, demo users, and family members
 */

const bcrypt = require('bcryptjs');

async function seed(db) {
    console.log('Seeding default users...');
    
    const users = [
        {
            name: "Estifanos Yohannis",
            nameAm: "እስቲፋኖስ ዮሐንስ",
            email: "johnsonestiph01@gmail.com",
            phone: "+251987713787",
            role: "super_admin",
            avatar: "👨‍💻",
            isActive: true,
            settings: {
                language: "en",
                theme: "dark",
                notifications: true,
                sound: true,
                twoFactorEnabled: false,
                temperatureUnit: "celsius"
            },
            createdAt: new Date(),
            updatedAt: new Date()
        },
        {
            name: "Admin User",
            nameAm: "አስተዳዳሪ",
            email: "admin@estif-home.com",
            phone: "+251911000000",
            role: "admin",
            avatar: "👨‍💼",
            isActive: true,
            settings: {
                language: "en",
                theme: "light",
                notifications: true,
                sound: true,
                twoFactorEnabled: false,
                temperatureUnit: "celsius"
            },
            createdAt: new Date(),
            updatedAt: new Date()
        },
        {
            name: "Family Member",
            nameAm: "የቤተሰብ አባል",
            email: "family@estif-home.com",
            phone: "+251922000000",
            role: "user",
            avatar: "👩",
            isActive: true,
            settings: {
                language: "am",
                theme: "light",
                notifications: true,
                sound: true,
                twoFactorEnabled: false,
                temperatureUnit: "celsius"
            },
            createdAt: new Date(),
            updatedAt: new Date()
        },
        {
            name: "Demo User",
            nameAm: "ማሳያ ተጠቃሚ",
            email: "demo@estif-home.com",
            phone: "+251933000000",
            role: "user",
            avatar: "🧑",
            isActive: true,
            settings: {
                language: "en",
                theme: "light",
                notifications: false,
                sound: true,
                twoFactorEnabled: false,
                temperatureUnit: "celsius"
            },
            createdAt: new Date(),
            updatedAt: new Date()
        }
    ];
    
    // Hash passwords
    const salt = await bcrypt.genSalt(12);
    for (const user of users) {
        user.password = await bcrypt.hash("Estif123!", salt);
    }
    
    // Insert users (skip if exists)
    for (const user of users) {
        const existing = await db.collection('users').findOne({ email: user.email });
        if (!existing) {
            await db.collection('users').insertOne(user);
            console.log(`Created user: ${user.email}`);
        } else {
            console.log(`User already exists: ${user.email}`);
        }
    }
    
    return await db.collection('users').find().toArray();
}

async function down(db) {
    console.log('Removing seeded users...');
    await db.collection('users').deleteMany({
        email: { $in: [
            'johnsonestiph01@gmail.com',
            'admin@estif-home.com',
            'family@estif-home.com',
            'demo@estif-home.com'
        ]}
    });
}

module.exports = { seed, down };