/**
 * Migration 003: Add Members Table
 * Creates members collection for multi-user home access
 */

async function up(db) {
    console.log('Running migration 003: Add Members Table');
    
    // Create members collection
    await db.createCollection('members', {
        validator: {
            $jsonSchema: {
                bsonType: 'object',
                required: ['homeId', 'userId', 'role'],
                properties: {
                    homeId: { bsonType: 'objectId' },
                    userId: { bsonType: 'objectId' },
                    role: { enum: ['owner', 'admin', 'member', 'guest'] },
                    permissions: {
                        bsonType: 'array',
                        items: {
                            bsonType: 'string',
                            enum: ['view', 'control', 'manage', 'invite']
                        }
                    },
                    joinedAt: { bsonType: 'date' },
                    invitedBy: { bsonType: 'objectId' },
                    isActive: { bsonType: 'bool', default: true }
                }
            }
        }
    });
    
    // Create indexes
    await db.collection('members').createIndex({ homeId: 1, userId: 1 }, { unique: true });
    await db.collection('members').createIndex({ userId: 1 });
    await db.collection('members').createIndex({ role: 1 });
    
    // Create invites collection
    await db.createCollection('invites', {
        validator: {
            $jsonSchema: {
                bsonType: 'object',
                required: ['homeId', 'email', 'token'],
                properties: {
                    homeId: { bsonType: 'objectId' },
                    email: { bsonType: 'string' },
                    token: { bsonType: 'string' },
                    role: { enum: ['admin', 'member', 'guest'], default: 'member' },
                    expiresAt: { bsonType: 'date' },
                    createdAt: { bsonType: 'date' },
                    acceptedAt: { bsonType: 'date' }
                }
            }
        }
    });
    
    await db.collection('invites').createIndex({ token: 1 }, { unique: true });
    await db.collection('invites').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
    await db.collection('invites').createIndex({ email: 1 });
}

async function down(db) {
    console.log('Rolling back migration 003');
    await db.collection('members').drop();
    await db.collection('invites').drop();
}

module.exports = { up, down };