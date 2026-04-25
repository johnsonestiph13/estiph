const User = require('../models/User');
const Home = require('../models/Home');
const Device = require('../models/Device');
const Automation = require('../models/Automation');
const Scene = require('../models/Scene');
const Setting = require('../models/Setting');

const { seedUsers } = require('./users');
const { seedHomes } = require('./homes');
const { seedDevices } = require('./devices');
const { seedAutomations } = require('./automations');
const { seedScenes } = require('./scenes');
const { seedSettings } = require('./settings');

const seedAll = async () => {
    console.log('🌱 Starting database seeding...\n');
    
    try {
        await seedUsers(User);
        await seedHomes(Home, User);
        await seedDevices(Device, Home, User);
        await seedAutomations(Automation, Device, User);
        await seedScenes(Scene, User);
        await seedSettings(Setting);
        
        console.log('\n✅ All seeds completed successfully!');
    } catch (error) {
        console.error('\n❌ Seeding failed:', error);
        process.exit(1);
    }
};

const seedReset = async () => {
    console.log('🔄 Resetting database...');
    
    await User.deleteMany({});
    await Home.deleteMany({});
    await Device.deleteMany({});
    await Automation.deleteMany({});
    await Scene.deleteMany({});
    await Setting.deleteMany({});
    
    console.log('✅ Database reset completed');
    await seedAll();
};

module.exports = { seedAll, seedReset };