const twilio = require('twilio');

let twilioClient = null;

const initSMS = () => {
    if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
        console.log('SMS not configured, skipping...');
        return null;
    }
    
    twilioClient = twilio(
        process.env.TWILIO_ACCOUNT_SID,
        process.env.TWILIO_AUTH_TOKEN
    );
    
    console.log('✅ SMS service initialized');
    return twilioClient;
};

const sendSMS = async (to, message) => {
    if (!twilioClient) {
        console.warn('SMS not configured, skipping send');
        return false;
    }
    
    try {
        const result = await twilioClient.messages.create({
            body: message,
            to: to,
            from: process.env.TWILIO_PHONE_NUMBER
        });
        
        console.log(`SMS sent: ${result.sid}`);
        return true;
    } catch (error) {
        console.error('SMS send error:', error);
        return false;
    }
};

const sendVerificationCode = async (phone, code) => {
    return sendSMS(phone, `Your Estif Home verification code is: ${code}. Valid for 10 minutes.`);
};

const sendAlertSMS = async (phone, deviceName, alertType) => {
    const message = `[Estif Home Alert] ${deviceName} - ${alertType}. Please check your app for details.`;
    return sendSMS(phone, message);
};

module.exports = {
    initSMS,
    sendSMS,
    sendVerificationCode,
    sendAlertSMS
};