/**
 * Migration 012: Add Voice Commands
 * Voice command history and training data
 */

async function up(db) {
    console.log('Running migration 012: Add Voice Commands');
    
    // Voice commands collection
    await db.createCollection('voice_commands', {
        validator: {
            $jsonSchema: {
                bsonType: 'object',
                required: ['userId', 'command', 'processed'],
                properties: {
                    userId: { bsonType: 'objectId' },
                    command: { bsonType: 'string' },
                    processed: { bsonType: 'bool', default: false },
                    result: { bsonType: 'object' },
                    confidence: { bsonType: 'double', minimum: 0, maximum: 1 },
                    language: { bsonType: 'string', default: 'en' },
                    processingTime: { bsonType: 'int' },
                    timestamp: { bsonType: 'date' }
                }
            }
        }
    });
    
    await db.collection('voice_commands').createIndex({ userId: 1, timestamp: -1 });
    await db.collection('voice_commands').createIndex({ processed: 1 });
    await db.collection('voice_commands').createIndex({ timestamp: 1 }, { expireAfterSeconds: 86400 * 90 });
    
    // Wake word models collection
    await db.createCollection('wake_word_models', {
        validator: {
            $jsonSchema: {
                bsonType: 'object',
                required: ['userId', 'samples'],
                properties: {
                    userId: { bsonType: 'objectId' },
                    samples: { bsonType: 'array' },
                    trainedAt: { bsonType: 'date' },
                    accuracy: { bsonType: 'double' }
                }
            }
        }
    });
    
    await db.collection('wake_word_models').createIndex({ userId: 1 }, { unique: true });
}

async function down(db) {
    console.log('Rolling back migration 012');
    await db.collection('voice_commands').drop();
    await db.collection('wake_word_models').drop();
}

module.exports = { up, down };