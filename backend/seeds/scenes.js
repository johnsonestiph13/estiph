const scenes = [
    {
        name: 'Good Morning',
        nameAm: 'እንደምን አደሩ',
        description: 'Start your day with morning routine',
        icon: '🌅',
        color: '#ffd166',
        deviceStates: {},
        transitionTime: 500,
        isActive: false,
        order: 1,
        tags: ['morning', 'daily']
    },
    {
        name: 'Good Night',
        nameAm: 'መልካም ሌሊት',
        description: 'Prepare for sleep',
        icon: '🌙',
        color: '#4361ee',
        deviceStates: {},
        transitionTime: 1000,
        isActive: false,
        order: 2,
        tags: ['night', 'daily']
    },
    {
        name: 'Movie Time',
        nameAm: 'ፊልም ሰዓት',
        description: 'Dim lights for cinema experience',
        icon: '🎬',
        color: '#7209b7',
        deviceStates: {},
        transitionTime: 800,
        isActive: false,
        order: 3,
        tags: ['entertainment']
    },
    {
        name: 'Party Mode',
        nameAm: 'የፓርቲ ሁነታ',
        description: 'Colorful lighting for parties',
        icon: '🎉',
        color: '#ef476f',
        deviceStates: {},
        transitionTime: 300,
        isActive: false,
        order: 4,
        tags: ['party', 'entertainment']
    },
    {
        name: 'Away Mode',
        nameAm: 'የሩቅ ሁነታ',
        description: 'Simulate presence while away',
        icon: '🚪',
        color: '#f9c74f',
        deviceStates: {},
        transitionTime: 200,
        isActive: false,
        order: 5,
        tags: ['security', 'away']
    },
    {
        name: 'Reading Mode',
        nameAm: 'የማንበብ ሁነታ',
        description: 'Optimal lighting for reading',
        icon: '📚',
        color: '#06d6a0',
        deviceStates: {},
        transitionTime: 400,
        isActive: false,
        order: 6,
        tags: ['reading']
    }
];

const seedScenes = async (Scene, User) => {
    try {
        const admin = await User.findOne({ email: 'estifanos@estif-home.com' });
        if (!admin) {
            console.log('❌ Admin user not found, skipping scenes seed');
            return;
        }
        
        for (const scene of scenes) {
            const existingScene = await Scene.findOne({ name: scene.name, userId: admin._id });
            if (!existingScene) {
                scene.userId = admin._id;
                await Scene.create(scene);
                console.log(`✅ Scene created: ${scene.name}`);
            } else {
                console.log(`⏭️ Scene already exists: ${scene.name}`);
            }
        }
        console.log('✅ Scenes seeded successfully');
    } catch (error) {
        console.error('❌ Error seeding scenes:', error);
    }
};

module.exports = { scenes, seedScenes };