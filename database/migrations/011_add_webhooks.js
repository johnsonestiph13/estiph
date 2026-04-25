/**
 * Migration 011: Add Webhooks
 * Webhook configurations and delivery logs
 */

async function up(db) {
    console.log('Running migration 011: Add Webhooks');
    
    // Webhooks collection
    await db.createCollection('webhooks', {
        validator: {
            $jsonSchema: {
                bsonType: 'object',
                required: ['userId', 'name', 'url', 'events'],
                properties: {
                    userId: { bsonType: 'objectId' },
                    name: { bsonType: 'string' },
                    url: { bsonType: 'string', pattern: '^https?://' },
                    events: { bsonType: 'array' },
                    secret: { bsonType: 'string' },
                    enabled: { bsonType: 'bool', default: true },
                    retryCount: { bsonType: 'int', default: 3 },
                    timeout: { bsonType: 'int', default: 5000 },
                    createdAt: { bsonType: 'date' },
                    updatedAt: { bsonType: 'date' }
                }
            }
        }
    });
    
    await db.collection('webhooks').createIndex({ userId: 1 });
    await db.collection('webhooks').createIndex({ enabled: 1 });
    
    // Webhook delivery logs
    await db.createCollection('webhook_deliveries', {
        validator: {
            $jsonSchema: {
                bsonType: 'object',
                required: ['webhookId', 'event', 'payload'],
                properties: {
                    webhookId: { bsonType: 'objectId' },
                    event: { bsonType: 'string' },
                    payload: { bsonType: 'object' },
                    statusCode: { bsonType: 'int' },
                    responseTime: { bsonType: 'int' },
                    success: { bsonType: 'bool' },
                    error: { bsonType: 'string' },
                    timestamp: { bsonType: 'date' }
                }
            }
        }
    });
    
    await db.collection('webhook_deliveries').createIndex({ webhookId: 1, timestamp: -1 });
    await db.collection('webhook_deliveries').createIndex({ timestamp: 1 }, { expireAfterSeconds: 86400 * 30 });
}

async function down(db) {
    console.log('Rolling back migration 011');
    await db.collection('webhooks').drop();
    await db.collection('webhook_deliveries').drop();
}

module.exports = { up, down };