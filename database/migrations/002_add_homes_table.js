/**
 * Migration 002: Add Homes Table Enhancements
 * Adds rooms, settings, and location fields
 */

async function up(db) {
    console.log('Running migration 002: Add Homes Table Enhancements');
    
    // Add rooms array to homes
    await db.collection('homes').updateMany(
        {},
        {
            $set: {
                rooms: [],
                settings: {
                    timezone: 'Africa/Addis_Ababa',
                    temperatureUnit: 'celsius',
                    language: 'en'
                },
                location: {
                    lat: null,
                    lng: null
                }
            }
        }
    );
    
    // Create indexes for geospatial queries
    await db.collection('homes').createIndex({ location: '2dsphere' });
    
    // Add WiFi networks collection
    await db.createCollection('wifi_networks', {
        validator: {
            $jsonSchema: {
                bsonType: 'object',
                required: ['homeId', 'ssid'],
                properties: {
                    homeId: { bsonType: 'objectId' },
                    ssid: { bsonType: 'string', minLength: 2, maxLength: 32 },
                    password: { bsonType: 'string' },
                    encryption: { enum: ['WPA2', 'WPA3', 'WEP', 'None'] },
                    isPrimary: { bsonType: 'bool', default: false },
                    createdAt: { bsonType: 'date' }
                }
            }
        }
    });
    
    await db.collection('wifi_networks').createIndex({ homeId: 1 });
    await db.collection('wifi_networks').createIndex({ isPrimary: 1 });
}

async function down(db) {
    console.log('Rolling back migration 002');
    await db.collection('homes').updateMany(
        {},
        {
            $unset: {
                rooms: '',
                settings: '',
                location: ''
            }
        }
    );
    await db.collection('wifi_networks').drop();
}

module.exports = { up, down };