/**
 * Migration 006: Add Notifications
 * User notifications and push tokens
 */

async function up(db) {
    console.log('Running migration 006: Add Notifications');
    
    // Notifications collection
    await db.createCollection('notifications', {
        validator: {
            $jsonSchema: {
                bsonType: 'object',
                required: ['userId', 'title', 'message', 'type'],
                properties: {
                    userId: { bsonType: 'objectId' },
                    title: { bsonType: 'string', maxLength: 200 },
                    message: { bsonType: 'string', maxLength: 1000 },
                    type: { enum: ['info', 'success', 'warning', 'error', 'alert'] },
                    read: { bsonType: 'bool', default: false },
                    data: { bsonType: 'object' },
                    createdAt: { bsonType: 'date' },
                    readAt: { bsonType: 'date' }
                }
            }
        }
    });
    
    await db.collection('notifications').createIndex({ userId: 1, createdAt: -1 });
    await db.collection('notifications').createIndex({ read: 1 });
    await db.collection('notifications').createIndex({ createdAt: 1 }, { expireAfterSeconds: 86400 * 7 }); // 7 days TTL
    
    // Push tokens collection
    await db.createCollection('push_tokens', {
        validator: {
            $jsonSchema: {
                bsonType: 'object',
                required: ['userId', 'token', 'platform'],
                properties: {
                    userId: { bsonType: 'objectId' },
                    token: { bsonType: 'string' },
                    platform: { enum: ['web', 'ios', 'android'] },
                    deviceInfo: { bsonType: 'object' },
                    createdAt: { bsonType: 'date' },
                    lastUsed: { bsonType: 'date' }
                }
            }
        }
    });
    
    await db.collection('push_tokens').createIndex({ userId: 1 });
    await db.collection('push_tokens').createIndex({ token: 1 }, { unique: true });
}

async function down(db) {
    console.log('Rolling back migration 006');
    await db.collection('notifications').drop();
    await db.collection('push_tokens').drop();
}

module.exports = { up, down };