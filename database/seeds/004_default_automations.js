/**
 * Seed 004: Default Automations
 * Creates automation rules for temperature, schedule, and scenes
 */

const { ObjectId } = require('mongodb');

async function seed(db, devices, homes) {
    console.log('Seeding default automations...');
    
    const mainHome = homes.find(h => h.name === 'Estif Home Ultimate');
    const light = devices.find(d => d.name === 'Living Room Light');
    const fan = devices.find(d => d.name === 'Bedroom Fan');
    const ac = devices.find(d => d.name === 'Living Room AC');
    const heater = devices.find(d => d.name === 'Bathroom Heater');
    const pump = devices.find(d => d.name === 'Garden Water Pump');
    
    const automations = [
        {
            name: "Morning Light Schedule",
            nameAm: "የጠዋት መብራት መርሐግብር",
            type: "schedule",
            enabled: true,
            trigger: {
                type: "time",
                time: "06:30",
                days: ["monday", "tuesday", "wednesday", "thursday", "friday"],
                condition: "weekdays"
            },
            action: {
                type: "device",
                deviceId: light._id,
                command: "on",
                params: { brightness: 80 }
            },
            homeId: mainHome._id,
            createdBy: mainHome.ownerId,
            createdAt: new Date(),
            updatedAt: new Date()
        },
        {
            name: "Night Light Schedule",
            nameAm: "የምሽት መብራት መርሐግብር",
            type: "schedule",
            enabled: true,
            trigger: {
                type: "time",
                time: "22:00",
                days: ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"],
                condition: "daily"
            },
            action: {
                type: "device",
                deviceId: light._id,
                command: "off"
            },
            homeId: mainHome._id,
            createdBy: mainHome.ownerId,
            createdAt: new Date(),
            updatedAt: new Date()
        },
        {
            name: "Temperature Control - Fan",
            nameAm: "የሙቀት መቆጣጠሪያ - ማራገቢያ",
            type: "temperature",
            enabled: true,
            trigger: {
                type: "temperature",
                sensor: "living_room",
                condition: "above",
                threshold: 26,
                hysteresis: 2
            },
            action: {
                type: "device",
                deviceId: fan._id,
                command: "on"
            },
            condition: {
                temperature: { $gt: 26 }
            },
            homeId: mainHome._id,
            createdBy: mainHome.ownerId,
            createdAt: new Date(),
            updatedAt: new Date()
        },
        {
            name: "Temperature Control - Heater",
            nameAm: "የሙቀት መቆጣጠሪያ - ማሞቂያ",
            type: "temperature",
            enabled: true,
            trigger: {
                type: "temperature",
                sensor: "bathroom",
                condition: "below",
                threshold: 18,
                hysteresis: 2
            },
            action: {
                type: "device",
                deviceId: heater._id,
                command: "on"
            },
            condition: {
                temperature: { $lt: 18 }
            },
            homeId: mainHome._id,
            createdBy: mainHome.ownerId,
            createdAt: new Date(),
            updatedAt: new Date()
        },
        {
            name: "AC Energy Saver",
            nameAm: "ኤሲ ኢነርጂ ቆጣቢ",
            type: "temperature",
            enabled: true,
            trigger: {
                type: "temperature",
                sensor: "living_room",
                condition: "above",
                threshold: 28,
                duration: 300 // 5 minutes
            },
            action: {
                type: "device",
                deviceId: ac._id,
                command: "on",
                params: { temperature: 24, mode: "cool" }
            },
            homeId: mainHome._id,
            createdBy: mainHome.ownerId,
            createdAt: new Date(),
            updatedAt: new Date()
        },
        {
            name: "Garden Watering Schedule",
            nameAm: "የአትክልት ውሃ መስኖ መርሐግብር",
            type: "schedule",
            enabled: true,
            trigger: {
                type: "cron",
                expression: "0 10 * * 1,3,5", // Mon, Wed, Fri at 10 AM
                timezone: "Africa/Addis_Ababa"
            },
            action: {
                type: "device",
                deviceId: pump._id,
                command: "on",
                params: { duration: 1800 } // 30 minutes
            },
            homeId: mainHome._id,
            createdBy: mainHome.ownerId,
            createdAt: new Date(),
            updatedAt: new Date()
        },
        {
            name: "Good Morning Routine",
            nameAm: "እንደምን አደርክ ስርዓት",
            type: "scene",
            enabled: true,
            trigger: {
                type: "time",
                time: "07:00",
                days: ["weekdays"]
            },
            action: {
                type: "scene",
                sceneName: "Good Morning",
                actions: [
                    { deviceId: light._id, command: "on", params: { brightness: 50 } },
                    { deviceId: ac._id, command: "on", params: { temperature: 22 } }
                ]
            },
            homeId: mainHome._id,
            createdBy: mainHome.ownerId,
            createdAt: new Date(),
            updatedAt: new Date()
        },
        {
            name: "Good Night Routine",
            nameAm: "መልካም ሌሊት ስርዓት",
            type: "scene",
            enabled: true,
            trigger: {
                type: "time",
                time: "23:00",
                days: ["daily"]
            },
            action: {
                type: "scene",
                sceneName: "Good Night",
                actions: [
                    { deviceId: light._id, command: "off" },
                    { deviceId: ac._id, command: "off" },
                    { deviceId: fan._id, command: "on", params: { speed: 1 } }
                ]
            },
            homeId: mainHome._id,
            createdBy: mainHome.ownerId,
            createdAt: new Date(),
            updatedAt: new Date()
        }
    ];
    
    // Insert automations
    const insertedAutomations = [];
    for (const automation of automations) {
        const existing = await db.collection('automations').findOne({ 
            name: automation.name, 
            homeId: automation.homeId 
        });
        if (!existing) {
            const result = await db.collection('automations').insertOne(automation);
            insertedAutomations.push({ ...automation, _id: result.insertedId });
            console.log(`Created automation: ${automation.name}`);
        } else {
            insertedAutomations.push(existing);
            console.log(`Automation already exists: ${automation.name}`);
        }
    }
    
    return insertedAutomations;
}

async function down(db) {
    console.log('Removing seeded automations...');
    await db.collection('automations').deleteMany({
        name: { $in: [
            'Morning Light Schedule', 'Night Light Schedule', 'Temperature Control - Fan',
            'Temperature Control - Heater', 'AC Energy Saver', 'Garden Watering Schedule',
            'Good Morning Routine', 'Good Night Routine'
        ]}
    });
}

module.exports = { seed, down };