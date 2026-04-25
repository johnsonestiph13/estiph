/**
 * Migration 001: Initial Schema
 * Creates core tables: users, sessions, homes, devices
 */

const mongoose = require('mongoose');

async function up(db) {
    console.log('Running migration 001: Initial Schema');
    
    // Users Collection
    await db.createCollection('users', {
        validator: {
            $jsonSchema: {
                bsonType: 'object',
                required: ['name', 'email', 'password', 'role'],
                properties: {
                    name: { bsonType: 'string', minLength: 2, maxLength: 100 },
                    nameAm: { bsonType: 'string', maxLength: 100 },
                    email: { bsonType: 'string', pattern: '^[^\\s@]+@([^\\s@.,]+\\.)+[^\\s@.,]{2,}$' },
                    password: { bsonType: 'string', minLength: 60 },
                    role: { enum: ['super_admin', 'admin', 'user'] },
                    avatar: { bsonType: 'string' },
                    phone: { bsonType: 'string', pattern: '^\\+?[0-9]{10,15}$' },
                    isActive: { bsonType: 'bool', default: true },
                    lastLogin: { bsonType: 'date' },
                    createdAt: { bsonType: 'date' },
                    updatedAt: { bsonType: 'date' }
                }
            }
        }
    });
    
    // Create indexes for users
    await db.collection('users').createIndex({ email: 1 }, { unique: true });
    await db.collection('users').createIndex({ role: 1 });
    await db.collection('users').createIndex({ isActive: 1 });
    await db.collection('users').createIndex({ createdAt: -1 });
    
    // Sessions Collection
    await db.createCollection('sessions', {
        validator: {
            $jsonSchema: {
                bsonType: 'object',
                required: ['userId', 'token', 'expiresAt'],
                properties: {
                    userId: { bsonType: 'objectId' },
                    token: { bsonType: 'string' },
                    refreshToken: { bsonType: 'string' },
                    ip: { bsonType: 'string' },
                    userAgent: { bsonType: 'string' },
                    expiresAt: { bsonType: 'date' },
                    createdAt: { bsonType: 'date' }
                }
            }
        }
    });
    
    await db.collection('sessions').createIndex({ token: 1 }, { unique: true });
    await db.collection('sessions').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
    await db.collection('sessions').createIndex({ userId: 1 });
    
    // Homes Collection
    await db.createCollection('homes', {
        validator: {
            $jsonSchema: {
                bsonType: 'object',
                required: ['name', 'ownerId'],
                properties: {
                    name: { bsonType: 'string', minLength: 2, maxLength: 100 },
                    nameAm: { bsonType: 'string', maxLength: 100 },
                    address: { bsonType: 'string', maxLength: 200 },
                    city: { bsonType: 'string', maxLength: 100 },
                    country: { bsonType: 'string', default: 'Ethiopia' },
                    ownerId: { bsonType: 'objectId' },
                    isActive: { bsonType: 'bool', default: true },
                    createdAt: { bsonType: 'date' },
                    updatedAt: { bsonType: 'date' }
                }
            }
        }
    });
    
    await db.collection('homes').createIndex({ ownerId: 1 });
    await db.collection('homes').createIndex({ name: 1 });
    
    // Devices Collection
    await db.createCollection('devices', {
        validator: {
            $jsonSchema: {
                bsonType: 'object',
                required: ['name', 'type', 'ownerId'],
                properties: {
                    name: { bsonType: 'string', minLength: 2, maxLength: 50 },
                    nameAm: { bsonType: 'string' },
                    type: { enum: ['light', 'fan', 'ac', 'heater', 'tv', 'pump', 'sensor'] },
                    gpio: { bsonType: 'int', minimum: 0, maximum: 39 },
                    power: { bsonType: 'int', minimum: 0, maximum: 5000 },
                    state: { bsonType: 'bool', default: false },
                    autoMode: { bsonType: 'bool', default: false },
                    ownerId: { bsonType: 'objectId' },
                    homeId: { bsonType: 'objectId' },
                    lastSeen: { bsonType: 'date' },
                    createdAt: { bsonType: 'date' },
                    updatedAt: { bsonType: 'date' }
                }
            }
        }
    });
    
    await db.collection('devices').createIndex({ ownerId: 1 });
    await db.collection('devices').createIndex({ homeId: 1 });
    await db.collection('devices').createIndex({ type: 1 });
    await db.collection('devices').createIndex({ gpio: 1 });
}

async function down(db) {
    console.log('Rolling back migration 001');
    await db.collection('users').drop();
    await db.collection('sessions').drop();
    await db.collection('homes').drop();
    await db.collection('devices').drop();
}

module.exports = { up, down };