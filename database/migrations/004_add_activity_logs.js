/**
 * Migration 004: Add Activity Logs
 * Tracks user actions and system events
 */

async function up(db) {
    console.log('Running migration 004: Add Activity Logs');
    
    await db.createCollection('activity_logs', {
        validator: {
            $jsonSchema: {
                bsonType: 'object',
                required: ['action', 'timestamp'],
                properties: {
                    userId: { bsonType: 'objectId' },
                    homeId: { bsonType: 'objectId' },
                    action: { 
                        bsonType: 'string',
                        enum: ['login', 'logout', 'device_on', 'device_off', 'device_toggle', 
                               'auto_mode_enabled', 'auto_mode_disabled', 'home_created', 
                               'home_updated', 'home_deleted', 'member_added', 'member_removed',
                               'voice_command', 'automation_triggered', 'schedule_executed']
                    },
                    entityType: { bsonType: 'string' },
                    entityId: { bsonType: 'string' },
                    details: { bsonType: 'object' },
                    ip: { bsonType: 'string' },
                    userAgent: { bsonType: 'string' },
                    timestamp: { bsonType: 'date' }
                }
            }
        }
    });
    
    // Create indexes for efficient queries
    await db.collection('activity_logs').createIndex({ userId: 1, timestamp: -1 });
    await db.collection('activity_logs').createIndex({ homeId: 1, timestamp: -1 });
    await db.collection('activity_logs').createIndex({ action: 1 });
    await db.collection('activity_logs').createIndex({ timestamp: 1 }, { expireAfterSeconds: 86400 * 30 }); // 30 days TTL
    await db.collection('activity_logs').createIndex({ entityType: 1, entityId: 1 });
}

async function down(db) {
    console.log('Rolling back migration 004');
    await db.collection('activity_logs').drop();
}

module.exports = { up, down };