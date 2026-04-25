/**
 * Seed 002: Default Homes
 * Creates main home, vacation home, and demo home
 */

const { ObjectId } = require('mongodb');

async function seed(db, users) {
    console.log('Seeding default homes...');
    
    // Get users
    const admin = await db.collection('users').findOne({ email: 'johnsonestiph01@gmail.com' });
    const family = await db.collection('users').findOne({ email: 'family@estif-home.com' });
    const demo = await db.collection('users').findOne({ email: 'demo@estif-home.com' });
    
    const homes = [
        {
            name: "Estif Home Ultimate",
            nameAm: "እስቲፍ ሆም አልቲሜት",
            address: "123 Tech Park, Bole Road",
            city: "Addis Ababa",
            country: "Ethiopia",
            zipCode: "1000",
            ownerId: admin._id,
            members: [
                { userId: admin._id, role: "owner", joinedAt: new Date() },
                { userId: family._id, role: "admin", joinedAt: new Date() }
            ],
            rooms: [
                { name: "Living Room", nameAm: "ሳሎን", icon: "🛋️", type: "living" },
                { name: "Master Bedroom", nameAm: "ዋና መኝታ", icon: "🛏️", type: "bedroom" },
                { name: "Kitchen", nameAm: "ኩሽና", icon: "🍳", type: "kitchen" },
                { name: "Bathroom", nameAm: "መታጠቢያ", icon: "🚿", type: "bathroom" },
                { name: "Office", nameAm: "ቢሮ", icon: "💼", type: "office" },
                { name: "Garden", nameAm: "አትክልት", icon: "🌺", type: "garden" }
            ],
            settings: {
                timezone: "Africa/Addis_Ababa",
                temperatureUnit: "celsius",
                language: "en",
                currency: "ETB",
                autoBackup: true
            },
            location: {
                type: "Point",
                coordinates: [38.7578, 8.9806]
            },
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date()
        },
        {
            name: "Vacation Home",
            nameAm: "የእረፍት ቤት",
            address: "456 Lake View, Hawassa",
            city: "Hawassa",
            country: "Ethiopia",
            zipCode: "5000",
            ownerId: admin._id,
            members: [
                { userId: admin._id, role: "owner", joinedAt: new Date() },
                { userId: family._id, role: "member", joinedAt: new Date() }
            ],
            rooms: [
                { name: "Living Room", nameAm: "ሳሎን", icon: "🛋️", type: "living" },
                { name: "Bedroom", nameAm: "መኝታ", icon: "🛏️", type: "bedroom" }
            ],
            settings: {
                timezone: "Africa/Addis_Ababa",
                temperatureUnit: "celsius",
                language: "en",
                currency: "ETB",
                autoBackup: true
            },
            location: {
                type: "Point",
                coordinates: [38.4761, 7.0629]
            },
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date()
        },
        {
            name: "Demo Home",
            nameAm: "ማሳያ ቤት",
            address: "789 Demo Street",
            city: "Addis Ababa",
            country: "Ethiopia",
            ownerId: demo._id,
            members: [
                { userId: demo._id, role: "owner", joinedAt: new Date() }
            ],
            rooms: [
                { name: "Living Room", nameAm: "ሳሎን", icon: "🛋️", type: "living" },
                { name: "Bedroom", nameAm: "መኝታ", icon: "🛏️", type: "bedroom" }
            ],
            settings: {
                timezone: "Africa/Addis_Ababa",
                temperatureUnit: "celsius",
                language: "en",
                currency: "ETB",
                autoBackup: false
            },
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date()
        }
    ];
    
    // Insert homes
    const insertedHomes = [];
    for (const home of homes) {
        const existing = await db.collection('homes').findOne({ name: home.name, ownerId: home.ownerId });
        if (!existing) {
            const result = await db.collection('homes').insertOne(home);
            insertedHomes.push({ ...home, _id: result.insertedId });
            console.log(`Created home: ${home.name}`);
        } else {
            insertedHomes.push(existing);
            console.log(`Home already exists: ${home.name}`);
        }
    }
    
    return insertedHomes;
}

async function down(db) {
    console.log('Removing seeded homes...');
    await db.collection('homes').deleteMany({
        name: { $in: ['Estif Home Ultimate', 'Vacation Home', 'Demo Home'] }
    });
}

module.exports = { seed, down };