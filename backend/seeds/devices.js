const devices = [
    { name: 'Living Room Light', nameAm: 'ሳሎን መብራት', type: 'light', room: 'Living Room', roomAm: 'ሳሎን', gpio: 23, power: 10, state: false, autoMode: false },
    { name: 'Bedroom Fan', nameAm: 'መኝታ ማራገቢያ', type: 'fan', room: 'Master Bedroom', roomAm: 'ዋና መኝታ', gpio: 22, power: 40, state: false, autoMode: true },
    { name: 'Living Room AC', nameAm: 'ሳሎን ኤሲ', type: 'ac', room: 'Living Room', roomAm: 'ሳሎን', gpio: 21, power: 120, state: false, autoMode: true },
    { name: 'Living Room TV', nameAm: 'ሳሎን ቲቪ', type: 'tv', room: 'Living Room', roomAm: 'ሳሎን', gpio: 19, power: 80, state: false, autoMode: false },
    { name: 'Bathroom Heater', nameAm: 'መታጠቢያ ማሞቂያ', type: 'heater', room: 'Bathroom', roomAm: 'መታጠቢያ', gpio: 18, power: 1500, state: false, autoMode: true },
    { name: 'Garden Pump', nameAm: 'አትክልት ፓምፕ', type: 'pump', room: 'Garden', roomAm: 'አትክልት', gpio: 5, power: 250, state: false, autoMode: false },
    { name: 'Office Light', nameAm: 'ቢሮ መብራት', type: 'light', room: 'Office', roomAm: 'ቢሮ', gpio: 17, power: 10, state: false, autoMode: false },
    { name: 'Kitchen Light', nameAm: 'ኩሽና መብራት', type: 'light', room: 'Kitchen', roomAm: 'ኩሽና', gpio: 16, power: 15, state: false, autoMode: true }
];

const seedDevices = async (Device, Home, User) => {
    try {
        const admin = await User.findOne({ email: 'estifanos@estif-home.com' });
        const mainHome = await Home.findOne({ name: 'Main Home', ownerId: admin?._id });
        
        if (!admin || !mainHome) {
            console.log('❌ Admin or Home not found, skipping devices seed');
            return;
        }
        
        for (const device of devices) {
            const existingDevice = await Device.findOne({ name: device.name, ownerId: admin._id });
            if (!existingDevice) {
                device.ownerId = admin._id;
                device.homeId = mainHome._id;
                await Device.create(device);
                console.log(`✅ Device created: ${device.name}`);
            } else {
                console.log(`⏭️ Device already exists: ${device.name}`);
            }
        }
        console.log('✅ Devices seeded successfully');
    } catch (error) {
        console.error('❌ Error seeding devices:', error);
    }
};

module.exports = { devices, seedDevices };