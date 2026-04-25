/**
 * Seed 007: Demo Data
 * Creates demo activity logs, energy logs, and voice commands for testing
 */

const { ObjectId } = require('mongodb');

async function seed(db, devices, homes) {
    console.log('Seeding demo data...');
    
    const mainHome = homes.find(h => h.name === 'Estif Home Ultimate');
    const light = devices.find(d => d.name === 'Living Room Light');
    const fan = devices.find(d => d.name === 'Bedroom Fan');
    const ac = devices.find(d => d.name === 'Living Room AC');
    
    // Generate demo activity logs for last 7 days
    const activityLogs = [];
    const actions = ['device_on', 'device_off', 'auto_mode_enabled', 'auto_mode_disabled', 'voice_command'];
    
    for (let i = 0; i < 100; i++) {
        const daysAgo = Math.floor(Math.random() * 7);
        const timestamp = new Date();
        timestamp.setDate(timestamp.getDate() - daysAgo);
        timestamp.setHours(Math.floor(Math.random() * 24), Math.floor(Math.random() * 60));
        
        activityLogs.push({
            userId: mainHome.ownerId,
            homeId: mainHome._id,
            action: actions[Math.floor(Math.random() * actions.length)],
            entityType: "device",
            entityId: [light._id, fan._id, ac._id][Math.floor(Math.random() * 3)].toString(),
            details: {
                device: [light.name, fan.name, ac.name][Math.floor(Math.random() * 3)],
                state: Math.random() > 0.5
            },
            ip: `192.168.1.${Math.floor(Math.random() * 255)}`,
            userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            timestamp: timestamp
        });
    }
    
    // Generate demo energy logs
    const energyLogs = [];
    for (let i = 0; i < 500; i++) {
        const hoursAgo = Math.floor(Math.random() * 168); // Last 7 days
        const timestamp = new Date();
        timestamp.setHours(timestamp.getHours() - hoursAgo);
        
        energyLogs.push({
            deviceId: [light._id, fan._id, ac._id][Math.floor(Math.random() * 3)],
            homeId: mainHome._id,
            power: Math.floor(Math.random() * 100) + 10, // 10-110 watts
            state: Math.random() > 0.3,
            duration: Math.floor(Math.random() * 3600), // 0-3600 seconds
            cost: (Math.random() * 0.5).toFixed(2),
            timestamp: timestamp
        });
    }
    
    // Generate demo voice commands
    const voiceCommands = [
        "turn on living room light",
        "turn off bedroom fan",
        "set AC to 22 degrees",
        "enable auto mode for light",
        "what's the temperature",
        "turn on all devices",
        "good morning",
        "good night",
        "ሰላም እስቲፍ መብራት አብራ",
        "ማራገቢያ አጥፋ"
    ];
    
    const voiceCommandLogs = [];
    for (let i = 0; i < 50; i++) {
        const daysAgo = Math.floor(Math.random() * 7);
        const timestamp = new Date();
        timestamp.setDate(timestamp.getDate() - daysAgo);
        
        voiceCommandLogs.push({
            userId: mainHome.ownerId,
            command: voiceCommands[Math.floor(Math.random() * voiceCommands.length)],
            processed: true,
            result: {
                action: "toggle",
                deviceId: light._id,
                state: Math.random() > 0.5
            },
            confidence: 0.7 + Math.random() * 0.3,
            language: Math.random() > 0.7 ? "am" : "en",
            processingTime: Math.floor(Math.random() * 500) + 100,
            timestamp: timestamp
        });
    }
    
    // Insert activity logs
    let insertedCount = 0;
    for (const log of activityLogs) {
        await db.collection('activity_logs').insertOne(log);
        insertedCount++;
    }
    console.log(`Created ${insertedCount} activity logs`);
    
    // Insert energy logs
    insertedCount = 0;
    for (const log of energyLogs) {
        await db.collection('energy_logs').insertOne(log);
        insertedCount++;
    }
    console.log(`Created ${insertedCount} energy logs`);
    
    // Insert voice commands
    insertedCount = 0;
    for (const cmd of voiceCommandLogs) {
        await db.collection('voice_commands').insertOne(cmd);
        insertedCount++;
    }
    console.log(`Created ${insertedCount} voice commands`);
    
    // Create demo device history
    const deviceHistory = [];
    for (let i = 0; i < 200; i++) {
        const hoursAgo = Math.floor(Math.random() * 168);
        const timestamp = new Date();
        timestamp.setHours(timestamp.getHours() - hoursAgo);
        
        deviceHistory.push({
            deviceId: light._id,
            state: Math.random() > 0.5,
            autoMode: Math.random() > 0.3,
            power: Math.random() > 0.5 ? 10 : 0,
            duration: Math.floor(Math.random() * 3600),
            triggeredBy: Math.random() > 0.5 ? "user" : "auto",
            timestamp: timestamp
        });
    }
    
    insertedCount = 0;
    for (const history of deviceHistory) {
        await db.collection('device_history').insertOne(history);
        insertedCount++;
    }
    console.log(`Created ${insertedCount} device history entries`);
    
    console.log('Demo data seeding completed!');
}

async function down(db) {
    console.log('Removing demo data...');
    await db.collection('activity_logs').deleteMany({});
    await db.collection('energy_logs').deleteMany({});
    await db.collection('voice_commands').deleteMany({});
    await db.collection('device_history').deleteMany({});
    console.log('Demo data removed');
}

module.exports = { seed, down };