/**
 * Migration 013: Add Device History
 * Historical device states for analytics
 */

async function up(db) {
    console.log('Running migration 013: Add Device History');
    
    await db.createCollection('device_history', {
        validator: {
            $jsonSchema: {
                bsonType: 'object',
                required: ['deviceId', 'state', 'timestamp'],
                properties: {
                    deviceId: { bsonType: 'objectId' },
                    state: { bsonType: 'bool' },
                    autoMode: { bsonType: 'bool' },
                    power: { bsonType: 'int' },
                    temperature: { bsonType: 'double' },
                    duration: { bsonType: 'int' },
                    triggeredBy: { bsonType: 'string' },
                    timestamp: { bsonType: 'date' }
                }
            }
        }
    });
    
    // Compound indexes for time-series queries
    await db.collection('device_history').createIndex({ deviceId: 1, timestamp: -1 });
    await db.collection('device_history').createIndex({ timestamp: 1 });
    await db.collection('device_history').createIndex({ deviceId: 1, state: 1, timestamp: -1 });
    
    // Device analytics view
    await db.createCollection('device_daily_stats', {
        viewOn: 'device_history',
        pipeline: [
            {
                $group: {
                    _id: {
                        deviceId: '$deviceId',
                        date: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp' } }
                    },
                    totalOnTime: { $sum: '$duration' },
                    avgPower: { $avg: '$power' },
                    stateChanges: { $sum: 1 }
                }
            }
        ]
    });
}

async function down(db) {
    console.log('Rolling back migration 013');
    await db.collection('device_history').drop();
    await db.collection('device_daily_stats').drop();
}

module.exports = { up, down };