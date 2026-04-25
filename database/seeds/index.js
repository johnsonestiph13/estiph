/**
 * Main Seed Runner
 * Executes all seed files in order
 */

const { MongoClient } = require('mongodb');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/estif_home';

async function runSeeds() {
    const client = new MongoClient(MONGODB_URI);
    
    try {
        await client.connect();
        console.log('Connected to MongoDB');
        
        const db = client.db();
        
        // Run seeds in order
        const users = await require('./001_default_users').seed(db);
        const homes = await require('./002_default_homes').seed(db, users);
        const devices = await require('./003_default_devices').seed(db, homes);
        await require('./004_default_automations').seed(db, devices, homes);
        await require('./005_default_scenes').seed(db, devices, homes);
        await require('./006_default_settings').seed(db);
        await require('./007_demo_data').seed(db, devices, homes);
        
        console.log('\n✅ All seeds completed successfully!');
        
    } catch (error) {
        console.error('❌ Seed error:', error);
    } finally {
        await client.close();
    }
}

// Run if called directly
if (require.main === module) {
    runSeeds();
}

module.exports = { runSeeds };