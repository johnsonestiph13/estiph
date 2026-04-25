/**
 * Migration 008: Add Performance Indexes
 * Optimizes query performance for all collections
 */

async function up(db) {
    console.log('Running migration 008: Add Performance Indexes');
    
    // Users collection indexes
    await db.collection('users').createIndex({ email: 1, isActive: 1 });
    await db.collection('users').createIndex({ role: 1, isActive: 1 });
    await db.collection('users').createIndex({ createdAt: -1, role: 1 });
    
    // Devices collection indexes
    await db.collection('devices').createIndex({ homeId: 1, type: 1 });
    await db.collection('devices').createIndex({ ownerId: 1, autoMode: 1 });
    await db.collection('devices').createIndex({ state: 1, autoMode: 1 });
    await db.collection('devices').createIndex({ lastSeen: -1 });
    
    // Homes collection indexes
    await db.collection('homes').createIndex({ ownerId: 1, isActive: 1 });
    await db.collection('homes').createIndex({ name: 'text', nameAm: 'text' });
    
    // Activity logs composite indexes
    await db.collection('activity_logs').createIndex({ userId: 1, action: 1, timestamp: -1 });
    await db.collection('activity_logs').createIndex({ homeId: 1, action: 1, timestamp: -1 });
    
    // Energy logs composite indexes
    await db.collection('energy_logs').createIndex({ deviceId: 1, timestamp: -1 });
    await db.collection('energy_logs').createIndex({ homeId: 1, timestamp: -1, power: -1 });
    
    // Members composite indexes
    await db.collection('members').createIndex({ homeId: 1, role: 1 });
    await db.collection('members').createIndex({ userId: 1, role: 1 });
    
    // Create text search indexes
    await db.collection('devices').createIndex({ name: 'text', nameAm: 'text', type: 'text' });
    await db.collection('homes').createIndex({ name: 'text', address: 'text', city: 'text' });
    
    // Partial indexes for active records
    await db.collection('devices').createIndex(
        { ownerId: 1, state: 1 },
        { partialFilterExpression: { isActive: true } }
    );
    
    await db.collection('sessions').createIndex(
        { userId: 1, expiresAt: 1 },
        { partialFilterExpression: { expiresAt: { $gt: new Date() } } }
    );
}

async function down(db) {
    console.log('Rolling back migration 008');
    // Indexes will be automatically removed when collections are dropped
    console.log('Indexes will be removed with their collections');
}

module.exports = { up, down };