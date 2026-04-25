const automations = [
    {
        name: 'Morning Light',
        nameAm: 'የጠዋት መብራት',
        description: 'Turn on living room light at 6:30 AM on weekdays',
        trigger: { type: 'schedule', config: { time: '06:30', days: [1,2,3,4,5] } },
        condition: { type: 'none', config: {} },
        action: { type: 'device_on', config: { deviceName: 'Living Room Light' } },
        enabled: true,
        priority: 1
    },
    {
        name: 'Night Light',
        nameAm: 'የምሽት መብራት',
        description: 'Turn off living room light at 10:00 PM',
        trigger: { type: 'schedule', config: { time: '22:00', days: [1,2,3,4,5,6,7] } },
        condition: { type: 'none', config: {} },
        action: { type: 'device_off', config: { deviceName: 'Living Room Light' } },
        enabled: true,
        priority: 1
    },
    {
        name: 'Temperature Control AC',
        nameAm: 'የሙቀት መቆጣጠሪያ ኤሲ',
        description: 'Turn on AC when temperature exceeds 26°C',
        trigger: { type: 'temperature', config: { operator: '>', value: 26, sensor: 'main' } },
        condition: { type: 'none', config: {} },
        action: { type: 'device_on', config: { deviceName: 'Living Room AC' } },
        enabled: true,
        priority: 2
    },
    {
        name: 'Temperature Control Heater',
        nameAm: 'የሙቀት መቆጣጠሪያ ማሞቂያ',
        description: 'Turn on heater when temperature drops below 18°C',
        trigger: { type: 'temperature', config: { operator: '<', value: 18, sensor: 'main' } },
        condition: { type: 'none', config: {} },
        action: { type: 'device_on', config: { deviceName: 'Bathroom Heater' } },
        enabled: true,
        priority: 2
    },
    {
        name: 'Garden Pump Schedule',
        nameAm: 'የአትክልት ፓምፕ መርሐግብር',
        description: 'Water garden at 10:00 AM daily',
        trigger: { type: 'schedule', config: { time: '10:00', days: [1,2,3,4,5,6,7] } },
        condition: { type: 'none', config: {} },
        action: { type: 'device_on', config: { deviceName: 'Garden Pump', duration: 3600000 } },
        enabled: true,
        priority: 1
    }
];

const seedAutomations = async (Automation, Device, User) => {
    try {
        const admin = await User.findOne({ email: 'estifanos@estif-home.com' });
        if (!admin) {
            console.log('❌ Admin user not found, skipping automations seed');
            return;
        }
        
        for (const automation of automations) {
            const existingAutomation = await Automation.findOne({ name: automation.name, userId: admin._id });
            if (!existingAutomation) {
                automation.userId = admin._id;
                await Automation.create(automation);
                console.log(`✅ Automation created: ${automation.name}`);
            } else {
                console.log(`⏭️ Automation already exists: ${automation.name}`);
            }
        }
        console.log('✅ Automations seeded successfully');
    } catch (error) {
        console.error('❌ Error seeding automations:', error);
    }
};

module.exports = { automations, seedAutomations };