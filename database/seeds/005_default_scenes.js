/**
 * Seed 005: Default Scenes
 * Creates scene presets for different moods and activities
 */

const { ObjectId } = require('mongodb');

async function seed(db, devices, homes) {
    console.log('Seeding default scenes...');
    
    const mainHome = homes.find(h => h.name === 'Estif Home Ultimate');
    const light = devices.find(d => d.name === 'Living Room Light');
    const fan = devices.find(d => d.name === 'Bedroom Fan');
    const ac = devices.find(d => d.name === 'Living Room AC');
    const tv = devices.find(d => d.name === 'Living Room TV');
    
    const scenes = [
        {
            name: "Movie Night",
            nameAm: "ፊልም ምሽት",
            icon: "🎬",
            color: "#6C63FF",
            actions: [
                {
                    deviceId: light._id,
                    command: "on",
                    params: { brightness: 20, color: "#FF6B6B" }
                },
                {
                    deviceId: tv._id,
                    command: "on",
                    params: { input: "HDMI1", volume: 30 }
                },
                {
                    deviceId: ac._id,
                    command: "on",
                    params: { temperature: 22, mode: "cool" }
                }
            ],
            homeId: mainHome._id,
            createdBy: mainHome.ownerId,
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date()
        },
        {
            name: "Reading Time",
            nameAm: "የማንበብ ጊዜ",
            icon: "📚",
            color: "#4ECDC4",
            actions: [
                {
                    deviceId: light._id,
                    command: "on",
                    params: { brightness: 60, color: "#FFE66D" }
                },
                {
                    deviceId: fan._id,
                    command: "on",
                    params: { speed: 1 }
                }
            ],
            homeId: mainHome._id,
            createdBy: mainHome.ownerId,
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date()
        },
        {
            name: "Party Mode",
            nameAm: "የድግስ ሁነታ",
            icon: "🎉",
            color: "#FF6B6B",
            actions: [
                {
                    deviceId: light._id,
                    command: "on",
                    params: { brightness: 100, effect: "disco" }
                },
                {
                    deviceId: tv._id,
                    command: "on",
                    params: { volume: 50 }
                },
                {
                    deviceId: ac._id,
                    command: "on",
                    params: { temperature: 20, mode: "cool" }
                }
            ],
            homeId: mainHome._id,
            createdBy: mainHome.ownerId,
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date()
        },
        {
            name: "Sleep Mode",
            nameAm: "የእንቅልፍ ሁነታ",
            icon: "😴",
            color: "#292F36",
            actions: [
                {
                    deviceId: light._id,
                    command: "off"
                },
                {
                    deviceId: tv._id,
                    command: "off"
                },
                {
                    deviceId: ac._id,
                    command: "on",
                    params: { temperature: 24, mode: "auto", fanSpeed: "low" }
                }
            ],
            homeId: mainHome._id,
            createdBy: mainHome.ownerId,
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date()
        },
        {
            name: "Away Mode",
            nameAm: "የሩቅ ሁነታ",
            icon: "🚪",
            color: "#E63946",
            actions: [
                {
                    deviceId: light._id,
                    command: "off"
                },
                {
                    deviceId: tv._id,
                    command: "off"
                },
                {
                    deviceId: ac._id,
                    command: "off"
                },
                {
                    deviceId: fan._id,
                    command: "off"
                }
            ],
            homeId: mainHome._id,
            createdBy: mainHome.ownerId,
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date()
        },
        {
            name: "Energy Saving",
            nameAm: "የኢነርጂ ቁጠባ",
            icon: "💚",
            color: "#2A9D8F",
            actions: [
                {
                    deviceId: light._id,
                    command: "on",
                    params: { brightness: 30 }
                },
                {
                    deviceId: ac._id,
                    command: "on",
                    params: { temperature: 25, mode: "eco" }
                }
            ],
            homeId: mainHome._id,
            createdBy: mainHome.ownerId,
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date()
        }
    ];
    
    // Insert scenes
    const insertedScenes = [];
    for (const scene of scenes) {
        const existing = await db.collection('scenes').findOne({ 
            name: scene.name, 
            homeId: scene.homeId 
        });
        if (!existing) {
            const result = await db.collection('scenes').insertOne(scene);
            insertedScenes.push({ ...scene, _id: result.insertedId });
            console.log(`Created scene: ${scene.name}`);
        } else {
            insertedScenes.push(existing);
            console.log(`Scene already exists: ${scene.name}`);
        }
    }
    
    return insertedScenes;
}

async function down(db) {
    console.log('Removing seeded scenes...');
    await db.collection('scenes').deleteMany({
        name: { $in: ['Movie Night', 'Reading Time', 'Party Mode', 'Sleep Mode', 'Away Mode', 'Energy Saving'] }
    });
}

module.exports = { seed, down };