const homes = [
    {
        name: 'Main Home',
        nameAm: 'ዋና ቤት',
        address: 'Bole Road, Addis Ababa',
        city: 'Addis Ababa',
        country: 'Ethiopia',
        zipCode: '1000',
        location: { lat: 9.0320, lng: 38.7469 },
        rooms: [
            { name: 'Living Room', nameAm: 'ሳሎን', icon: '🛋️', type: 'living' },
            { name: 'Master Bedroom', nameAm: 'ዋና መኝታ', icon: '🛏️', type: 'bedroom' },
            { name: 'Kitchen', nameAm: 'ኩሽና', icon: '🍳', type: 'kitchen' },
            { name: 'Bathroom', nameAm: 'መታጠቢያ', icon: '🚿', type: 'bathroom' },
            { name: 'Office', nameAm: 'ቢሮ', icon: '💼', type: 'office' },
            { name: 'Garden', nameAm: 'አትክልት', icon: '🌳', type: 'garden' }
        ],
        settings: {
            timezone: 'Africa/Addis_Ababa',
            temperatureUnit: 'celsius',
            language: 'am',
            theme: 'light'
        },
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
    },
    {
        name: 'Vacation Home',
        nameAm: 'የእረፍት ቤት',
        address: 'Lake Side, Bahir Dar',
        city: 'Bahir Dar',
        country: 'Ethiopia',
        zipCode: '6000',
        location: { lat: 11.5742, lng: 37.3613 },
        rooms: [
            { name: 'Living Room', nameAm: 'ሳሎን', icon: '🛋️', type: 'living' },
            { name: 'Bedroom', nameAm: 'መኝታ', icon: '🛏️', type: 'bedroom' },
            { name: 'Kitchen', nameAm: 'ኩሽና', icon: '🍳', type: 'kitchen' }
        ],
        settings: {
            timezone: 'Africa/Addis_Ababa',
            temperatureUnit: 'celsius',
            language: 'en',
            theme: 'dark'
        },
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
    }
];

const seedHomes = async (Home, User) => {
    try {
        const admin = await User.findOne({ email: 'estifanos@estif-home.com' });
        if (!admin) {
            console.log('❌ Admin user not found, skipping homes seed');
            return;
        }
        
        for (const home of homes) {
            const existingHome = await Home.findOne({ name: home.name, ownerId: admin._id });
            if (!existingHome) {
                home.ownerId = admin._id;
                home.members = [{ userId: admin._id, role: 'owner', joinedAt: new Date() }];
                await Home.create(home);
                console.log(`✅ Home created: ${home.name}`);
            } else {
                console.log(`⏭️ Home already exists: ${home.name}`);
            }
        }
        console.log('✅ Homes seeded successfully');
    } catch (error) {
        console.error('❌ Error seeding homes:', error);
    }
};

module.exports = { homes, seedHomes };