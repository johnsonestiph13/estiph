const settings = [
    {
        category: 'system',
        key: 'maintenance_mode',
        value: false,
        description: 'Enable maintenance mode',
        isEditable: true,
        type: 'boolean'
    },
    {
        category: 'system',
        key: 'api_rate_limit',
        value: 100,
        description: 'API rate limit per minute',
        isEditable: true,
        type: 'number'
    },
    {
        category: 'system',
        key: 'session_timeout',
        value: 86400000,
        description: 'Session timeout in milliseconds',
        isEditable: true,
        type: 'number'
    },
    {
        category: 'energy',
        key: 'energy_rate',
        value: 0.12,
        description: 'Cost per kWh in USD',
        isEditable: true,
        type: 'number'
    },
    {
        category: 'energy',
        key: 'carbon_factor',
        value: 0.45,
        description: 'CO2 emissions per kWh in kg',
        isEditable: true,
        type: 'number'
    },
    {
        category: 'notification',
        key: 'push_enabled',
        value: true,
        description: 'Enable push notifications',
        isEditable: true,
        type: 'boolean'
    },
    {
        category: 'notification',
        key: 'email_enabled',
        value: true,
        description: 'Enable email notifications',
        isEditable: true,
        type: 'boolean'
    },
    {
        category: 'backup',
        key: 'auto_backup',
        value: true,
        description: 'Enable automatic backups',
        isEditable: true,
        type: 'boolean'
    },
    {
        category: 'backup',
        key: 'backup_retention_days',
        value: 30,
        description: 'Days to keep backups',
        isEditable: true,
        type: 'number'
    },
    {
        category: 'security',
        key: 'mfa_required',
        value: false,
        description: 'Require MFA for all users',
        isEditable: true,
        type: 'boolean'
    },
    {
        category: 'security',
        key: 'password_expiry_days',
        value: 90,
        description: 'Days until password expires',
        isEditable: true,
        type: 'number'
    }
];

const seedSettings = async (Setting) => {
    try {
        for (const setting of settings) {
            const existingSetting = await Setting.findOne({ key: setting.key });
            if (!existingSetting) {
                await Setting.create(setting);
                console.log(`✅ Setting created: ${setting.key}`);
            } else {
                console.log(`⏭️ Setting already exists: ${setting.key}`);
            }
        }
        console.log('✅ Settings seeded successfully');
    } catch (error) {
        console.error('❌ Error seeding settings:', error);
    }
};

module.exports = { settings, seedSettings };