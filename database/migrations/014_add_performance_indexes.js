/**
 * Migration 014: Add Performance Indexes
 * Advanced indexes for query optimization
 */

async function up(db) {
    console.log('Running migration 014: Add Performance Indexes');
    
    // Wildcard indexes for dynamic queries
    await db.collection('users').createIndex({ 'settings': 1 });
    await db.collection('devices').createIndex({ 'metadata': 'wildcard' });
    
    // Compound indexes for common query patterns
    await db.collection('activity_logs').createIndex(
        { homeId: 1, action: 1, timestamp: -1 },
        { name: 'home_action_time_idx' }
    );
    
    await db.collection('energy_logs').createIndex(
        { homeId: 1, timestamp: -1, power: -1 },
        { name: 'home_time_power_idx' }
    );
    
    // Partial indexes for active records
    await db.collection('devices').createIndex(
        { homeId: 1, state: 1 },
        { 
            partialFilterExpression: { isActive: true },
            name: 'active_devices_idx'
        }
    );
    
    // Sparse indexes for optional fields
    await db.collection('users').createIndex(
        { phone: 1 },
        { sparse: true, unique: true }
    );
    
    // Background indexes for large collections
    await db.collection('device_history').createIndex(
        { deviceId: 1, timestamp: -1 },
        { background: true }
    );
    
    // Covered queries index
    await db.collection('devices').createIndex(
        { ownerId: 1, name: 1, state: 1, type: 1 },
        { name: 'covered_devices_query' }
    );
    
    // Date range queries index
    await db.collection('energy_logs').createIndex(
        { timestamp: 1, homeId: 1 },
        { expireAfterSeconds: 0 }
    );
    
    console.log('All performance indexes created successfully');
}

async function down(db) {
    console.log('Rolling back migration 014');
    // Drop all indexes created in this migration
    const indexes = [
        'home_action_time_idx',
        'home_time_power_idx',
        'active_devices_idx',
        'covered_devices_query'
    ];
    
    for (const indexName of indexes) {
        try {
            await db.collection('activity_logs').dropIndex(indexName);
        } catch (e) {
            console.log(`Index ${indexName} may not exist`);
        }
    }
}

module.exports = { up, down };