const bcrypt = require('bcryptjs');

const users = [
    {
        name: 'Super Admin',
        nameAm: 'ሱፐር አድሚን',
        email: 'admin@estif-home.com',
        password: 'Admin@123456',
        role: 'super_admin',
        avatar: 'https://ui-avatars.com/api/?name=Super+Admin&background=4361ee&color=fff',
        phone: '+251911111111',
        isActive: true,
        isEmailVerified: true,
        settings: {
            language: 'en',
            theme: 'light',
            notifications: true,
            twoFactorEnabled: false
        },
        createdAt: new Date(),
        updatedAt: new Date()
    },
    {
        name: 'Estifanos Yohannis',
        nameAm: 'እስቲፋኖስ ዮሐንስ',
        email: 'estifanos@estif-home.com',
        password: 'Estif@2024',
        role: 'admin',
        avatar: 'https://ui-avatars.com/api/?name=Estifanos+Yohannis&background=7209b7&color=fff',
        phone: '+251987713787',
        isActive: true,
        isEmailVerified: true,
        settings: {
            language: 'am',
            theme: 'light',
            notifications: true,
            twoFactorEnabled: false
        },
        createdAt: new Date(),
        updatedAt: new Date()
    },
    {
        name: 'Family Member',
        nameAm: 'የቤተሰብ አባል',
        email: 'family@estif-home.com',
        password: 'Family@123',
        role: 'user',
        avatar: 'https://ui-avatars.com/api/?name=Family+Member&background=06d6a0&color=fff',
        phone: '+251922222222',
        isActive: true,
        isEmailVerified: true,
        settings: {
            language: 'en',
            theme: 'dark',
            notifications: true,
            twoFactorEnabled: false
        },
        createdAt: new Date(),
        updatedAt: new Date()
    },
    {
        name: 'Guest User',
        nameAm: 'እንግዳ ተጠቃሚ',
        email: 'guest@estif-home.com',
        password: 'Guest@123',
        role: 'user',
        avatar: 'https://ui-avatars.com/api/?name=Guest+User&background=ef476f&color=fff',
        phone: '+251933333333',
        isActive: true,
        isEmailVerified: false,
        settings: {
            language: 'en',
            theme: 'light',
            notifications: false,
            twoFactorEnabled: false
        },
        createdAt: new Date(),
        updatedAt: new Date()
    }
];

const seedUsers = async (User) => {
    try {
        for (const user of users) {
            const existingUser = await User.findOne({ email: user.email });
            if (!existingUser) {
                const hashedPassword = await bcrypt.hash(user.password, 12);
                user.password = hashedPassword;
                await User.create(user);
                console.log(`✅ User created: ${user.email}`);
            } else {
                console.log(`⏭️ User already exists: ${user.email}`);
            }
        }
        console.log('✅ Users seeded successfully');
    } catch (error) {
        console.error('❌ Error seeding users:', error);
    }
};

module.exports = { users, seedUsers };