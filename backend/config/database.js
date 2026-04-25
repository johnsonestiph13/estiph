const mongoose = require('mongoose');

const connectDB = async () => {
    try {
        const conn = await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/estif_home', {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            maxPoolSize: 10,
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000,
            family: 4
        });
        
        console.log(`✅ MongoDB connected: ${conn.connection.host}`);
        
        mongoose.connection.on('error', (err) => {
            console.error('MongoDB connection error:', err);
        });
        
        mongoose.connection.on('disconnected', () => {
            console.warn('MongoDB disconnected');
        });
        
        process.on('SIGINT', async () => {
            await mongoose.connection.close();
            console.log('MongoDB connection closed');
            process.exit(0);
        });
        
        return conn;
    } catch (error) {
        console.error('❌ MongoDB connection error:', error);
        process.exit(1);
    }
};

const disconnectDB = async () => {
    await mongoose.disconnect();
};

module.exports = { connectDB, disconnectDB };