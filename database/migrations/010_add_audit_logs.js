/**
 * Migration 010: Add Audit Logs
 * Security audit trail for compliance
 */

async function up(db) {
    console.log('Running migration 010: Add Audit Logs');
    
    await db.createCollection('audit_logs', {
        validator: {
            $jsonSchema: {
                bsonType: 'object',
                required: ['userId', 'action', 'timestamp'],
                properties: {
                    userId: { bsonType: 'objectId' },
                    action: { 
                        bsonType: 'string',
                        enum: ['login_attempt', 'password_change', '2fa_enabled', '2fa_disabled',
                               'permission_change', 'role_change', 'data_export', 'data_deletion',
                               'api_key_created', 'api_key_revoked', 'security_settings_updated']
                    },
                    status: { enum: ['success', 'failure', 'pending'] },
                    ip: { bsonType: 'string' },
                    userAgent: { bsonType: 'string' },
                    details: { bsonType: 'object' },
                    timestamp: { bsonType: 'date' }
                }
            }
        }
    });
    
    await db.collection('audit_logs').createIndex({ userId: 1, timestamp: -1 });
    await db.collection('audit_logs').createIndex({ action: 1, timestamp: -1 });
    await db.collection('audit_logs').createIndex({ ip: 1 });
    await db.collection('audit_logs').createIndex({ timestamp: 1 }, { expireAfterSeconds: 86400 * 365 }); // 1 year retention
    
    // API keys collection
    await db.createCollection('api_keys', {
        validator: {
            $jsonSchema: {
                bsonType: 'object',
                required: ['userId', 'name', 'key'],
                properties: {
                    userId: { bsonType: 'objectId' },
                    name: { bsonType: 'string' },
                    key: { bsonType: 'string' },
                    permissions: { bsonType: 'array' },
                    lastUsed: { bsonType: 'date' },
                    expiresAt: { bsonType: 'date' },
                    createdAt: { bsonType: 'date' },
                    isActive: { bsonType: 'bool', default: true }
                }
            }
        }
    });
    
    await db.collection('api_keys').createIndex({ key: 1 }, { unique: true });
    await db.collection('api_keys').createIndex({ userId: 1 });
    await db.collection('api_keys').createIndex({ expiresAt: 1 });
}

async function down(db) {
    console.log('Rolling back migration 010');
    await db.collection('audit_logs').drop();
    await db.collection('api_keys').drop();
}

module.exports = { up, down };