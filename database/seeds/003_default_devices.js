/**
 * Seed 003: Default Devices
 * Creates smart devices with GPIO mapping and auto conditions
 */

const { ObjectId } = require('mongodb');

async function seed(db, homes) {
    console.log('Seeding default devices...');
    
    // Get main home
    const mainHome = homes.find(h => h.name === 'Estif Home Ultimate');
    const vacationHome = homes.find(h => h.name === 'Vacation Home');
    const demoHome = homes.find(h => h.name === 'Demo Home');
    
    // GPIO Device Mapping based on user requirements
    const devices = [
        // Main Home Devices
        {
            name: "Living Room Light",
            nameAm: "የሳሎን መብራት",
            type: "light",
            gpio: 23,
            power: 10,
            state: false,
            autoMode: true,
            room: "Living Room",
            roomAm: "ሳሎን",
            homeId: mainHome._id,
            ownerId: mainHome.ownerId,
            autoConditions: {
                schedule: {
                    on: "06:30",
                    off: "22:00",
                    days: ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]
                }
            },
            icon: "💡",
            isActive: true,
            createdAt: new Date()
        },
        {
            name: "Bedroom Fan",
            nameAm: "የመኝታ ማራገቢያ",
            type: "fan",
            gpio: 22,
            power: 40,
            state: false,
            autoMode: true,
            room: "Master Bedroom",
            roomAm: "ዋና መኝታ",
            homeId: mainHome._id,
            ownerId: mainHome.ownerId,
            autoConditions: {
                temperature: {
                    on: 26,
                    off: 24
                }
            },
            icon: "🌀",
            isActive: true,
            createdAt: new Date()
        },
        {
            name: "Living Room AC",
            nameAm: "የሳሎን አየር ማቀዝቀዣ",
            type: "ac",
            gpio: 19,
            power: 120,
            state: false,
            autoMode: true,
            room: "Living Room",
            roomAm: "ሳሎን",
            homeId: mainHome._id,
            ownerId: mainHome.ownerId,
            autoConditions: {
                temperature: {
                    on: 26,
                    off: 24
                }
            },
            icon: "❄️",
            isActive: true,
            createdAt: new Date()
        },
        {
            name: "Bathroom Heater",
            nameAm: "የመታጠቢያ ማሞቂያ",
            type: "heater",
            gpio: 21,
            power: 1500,
            state: false,
            autoMode: true,
            room: "Bathroom",
            roomAm: "መታጠቢያ",
            homeId: mainHome._id,
            ownerId: mainHome.ownerId,
            autoConditions: {
                temperature: {
                    on: 18,
                    off: 20
                }
            },
            icon: "🔥",
            isActive: true,
            createdAt: new Date()
        },
        {
            name: "Living Room TV",
            nameAm: "ቴሌቪዥን",
            type: "tv",
            gpio: 18,
            power: 80,
            state: false,
            autoMode: false,
            room: "Living Room",
            roomAm: "ሳሎን",
            homeId: mainHome._id,
            ownerId: mainHome.ownerId,
            icon: "📺",
            isActive: true,
            createdAt: new Date()
        },
        {
            name: "Garden Water Pump",
            nameAm: "የአትክልት ውሃ ፓምፕ",
            type: "pump",
            gpio: 5,
            power: 250,
            state: false,
            autoMode: true,
            room: "Garden",
            roomAm: "አትክልት",
            homeId: mainHome._id,
            ownerId: mainHome.ownerId,
            autoConditions: {
                schedule: {
                    on: "10:00",
                    off: "16:00",
                    days: ["monday", "wednesday", "friday"]
                }
            },
            icon: "💧",
            isActive: true,
            createdAt: new Date()
        },
        {
            name: "Temperature Sensor",
            nameAm: "የሙቀት ዳሳሽ",
            type: "sensor",
            gpio: 34,
            power: 0,
            state: true,
            autoMode: false,
            room: "Living Room",
            roomAm: "ሳሎን",
            homeId: mainHome._id,
            ownerId: mainHome.ownerId,
            metadata: {
                sensorType: "DHT22",
                readingInterval: 60 // seconds
            },
            icon: "🌡️",
            isActive: true,
            createdAt: new Date()
        },
        
        // Vacation Home Devices
        {
            name: "Vacation Light",
            nameAm: "የእረፍት መብራት",
            type: "light",
            gpio: 23,
            power: 10,
            state: false,
            autoMode: true,
            room: "Living Room",
            roomAm: "ሳሎን",
            homeId: vacationHome._id,
            ownerId: vacationHome.ownerId,
            autoConditions: {
                schedule: {
                    on: "18:00",
                    off: "06:00",
                    days: ["saturday", "sunday"]
                }
            },
            icon: "💡",
            isActive: true,
            createdAt: new Date()
        },
        
        // Demo Home Devices
        {
            name: "Demo Light",
            nameAm: "ማሳያ መብራት",
            type: "light",
            gpio: 23,
            power: 10,
            state: false,
            autoMode: false,
            room: "Living Room",
            roomAm: "ሳሎን",
            homeId: demoHome._id,
            ownerId: demoHome.ownerId,
            icon: "💡",
            isActive: true,
            createdAt: new Date()
        }
    ];
    
    // Insert devices
    const insertedDevices = [];
    for (const device of devices) {
        const existing = await db.collection('devices').findOne({ 
            name: device.name, 
            homeId: device.homeId 
        });
        if (!existing) {
            const result = await db.collection('devices').insertOne(device);
            insertedDevices.push({ ...device, _id: result.insertedId });
            console.log(`Created device: ${device.name}`);
        } else {
            insertedDevices.push(existing);
            console.log(`Device already exists: ${device.name}`);
        }
    }
    
    return insertedDevices;
}

async function down(db) {
    console.log('Removing seeded devices...');
    await db.collection('devices').deleteMany({
        name: { $in: [
            'Living Room Light', 'Bedroom Fan', 'Living Room AC', 'Bathroom Heater',
            'Living Room TV', 'Garden Water Pump', 'Temperature Sensor',
            'Vacation Light', 'Demo Light'
        ]}
    });
}

module.exports = { seed, down };