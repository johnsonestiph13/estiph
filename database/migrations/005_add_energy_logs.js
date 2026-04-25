/**
 * Migration 005: Add Energy Logs
 * Tracks power consumption and energy analytics
 */

async function up(db) {
    console.log('Running migration 005: Add Energy Logs');
    
    await db.createCollection('energy_logs', {
        validator: {
            $jsonSchema: {
                bsonType: 'object',
                required: ['deviceId', 'power', 'timestamp'],
                properties: {
                    deviceId: { bsonType: 'objectId' },
                    homeId: { bsonType: 'objectId' },
                    power: { bsonType: 'int', minimum: 0 }, // Watts
                    state: { bsonType: 'bool' },
                    duration: { bsonType: 'int', minimum: 0 }, // Seconds
                    cost: { bsonType: 'double', minimum: 0 }, // Estimated cost
                    timestamp: { bsonType: 'date' }
                }
            }
        }
    });
    
    // Create indexes for time-series queries
    await db.collection('energy_logs').createIndex({ deviceId: 1, timestamp: -1 });
    await db.collection('energy_logs').createIndex({ homeId: 1, timestamp: -1 });
    await db.collection('energy_logs').createIndex({ timestamp: 1 });
    
    // Create hourly energy aggregation view
    await db.createCollection('energy_hourly', {
        viewOn: 'energy_logs',
        pipeline: [
            {
                $group: {
                    _id: {
                        homeId: '$homeId',
                        hour: { $hour: '$timestamp' },
                        day: { $dayOfMonth: '$timestamp' },
                        month: { $month: '$timestamp' },
                        year: { $year: '$timestamp' }
                    },
                    totalPower: { $sum: '$power' },
                    avgPower: { $avg: '$power' },
                    count: { $sum: 1 }
                }
            }
        ]
    });
}

async function down(db) {
    console.log('Rolling back migration 005');
    await db.collection('energy_logs').drop();
    await db.collection('energy_hourly').drop();
}

module.exports = { up, down };