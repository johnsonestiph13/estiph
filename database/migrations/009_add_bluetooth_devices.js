/**
 * Migration 009: Add Bluetooth Devices
 * Bluetooth device management and proximity tracking
 */

async function up(db) {
    console.log('Running migration 009: Add Bluetooth Devices');
    
    // Bluetooth devices collection
    await db.createCollection('bluetooth_devices', {
        validator: {
            $jsonSchema: {
                bsonType: 'object',
                required: ['address', 'name', 'userId'],
                properties: {
                    address: { bsonType: 'string', pattern: '^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$' },
                    name: { bsonType: 'string' },
                    userId: { bsonType: 'objectId' },
                    homeId: { bsonType: 'objectId' },
                    type: { enum: ['beacon', 'phone', 'watch', 'tag'] },
                    rssi: { bsonType: 'int' },
                    lastSeen: { bsonType: 'date' },
                    isPaired: { bsonType: 'bool', default: false },
                    createdAt: { bsonType: 'date' }
                }
            }
        }
    });
    
    await db.collection('bluetooth_devices').createIndex({ address: 1 }, { unique: true });
    await db.collection('bluetooth_devices').createIndex({ userId: 1 });
    await db.collection('bluetooth_devices').createIndex({ homeId: 1 });
    await db.collection('bluetooth_devices').createIndex({ lastSeen: -1 });
    
    // Proximity triggers collection
    await db.createCollection('proximity_triggers', {
        validator: {
            $jsonSchema: {
                bsonType: 'object',
                required: ['deviceId', 'triggerDeviceId'],
                properties: {
                    deviceId: { bsonType: 'objectId' }, // Bluetooth device
                    triggerDeviceId: { bsonType: 'objectId' }, // Smart home device
                    onEnter: { bsonType: 'object' },
                    onExit: { bsonType: 'object' },
                    range: { bsonType: 'int', minimum: 1, maximum: 50 },
                    enabled: { bsonType: 'bool', default: true }
                }
            }
        }
    });
    
    await db.collection('proximity_triggers').createIndex({ deviceId: 1 });
    await db.collection('proximity_triggers').createIndex({ triggerDeviceId: 1 });
}

async function down(db) {
    console.log('Rolling back migration 009');
    await db.collection('bluetooth_devices').drop();
    await db.collection('proximity_triggers').drop();
}

module.exports = { up, down };