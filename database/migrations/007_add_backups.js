/**
 * Migration 007: Add Backups
 * System backups and restore points
 */

async function up(db) {
    console.log('Running migration 007: Add Backups');
    
    await db.createCollection('backups', {
        validator: {
            $jsonSchema: {
                bsonType: 'object',
                required: ['filename', 'size', 'type'],
                properties: {
                    filename: { bsonType: 'string' },
                    size: { bsonType: 'int' },
                    type: { enum: ['full', 'incremental', 'schema'] },
                    status: { enum: ['pending', 'completed', 'failed'], default: 'pending' },
                    metadata: { bsonType: 'object' },
                    createdBy: { bsonType: 'objectId' },
                    createdAt: { bsonType: 'date' },
                    completedAt: { bsonType: 'date' }
                }
            }
        }
    });
    
    await db.collection('backups').createIndex({ createdAt: -1 });
    await db.collection('backups').createIndex({ status: 1 });
    await db.collection('backups').createIndex({ type: 1 });
}

async function down(db) {
    console.log('Rolling back migration 007');
    await db.collection('backups').drop();
}

module.exports = { up, down };