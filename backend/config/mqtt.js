const mqtt = require('mqtt');

let mqttClient = null;

const initMQTT = () => {
    if (!process.env.MQTT_BROKER) {
        console.log('MQTT not configured, skipping...');
        return null;
    }
    
    const options = {
        username: process.env.MQTT_USERNAME,
        password: process.env.MQTT_PASSWORD,
        keepalive: 60,
        reconnectPeriod: 5000,
        connectTimeout: 30000,
        will: {
            topic: 'estif/status',
            payload: JSON.stringify({ status: 'offline', timestamp: Date.now() }),
            qos: 1,
            retain: true
        }
    };
    
    mqttClient = mqtt.connect(process.env.MQTT_BROKER, options);
    
    mqttClient.on('connect', () => {
        console.log('✅ MQTT connected');
        mqttClient.subscribe('estif/+/+', { qos: 1 });
    });
    
    mqttClient.on('error', (err) => {
        console.error('❌ MQTT error:', err);
    });
    
    mqttClient.on('reconnect', () => {
        console.log('🔄 MQTT reconnecting...');
    });
    
    mqttClient.on('offline', () => {
        console.log('📡 MQTT offline');
    });
    
    return mqttClient;
};

const publishMQTT = async (topic, message, options = {}) => {
    if (!mqttClient || !mqttClient.connected) {
        console.warn('MQTT not connected, message not sent');
        return false;
    }
    
    return new Promise((resolve) => {
        const payload = typeof message === 'string' ? message : JSON.stringify(message);
        mqttClient.publish(topic, payload, options, (err) => {
            if (err) {
                console.error('MQTT publish error:', err);
                resolve(false);
            } else {
                resolve(true);
            }
        });
    });
};

const subscribeMQTT = (topic, callback) => {
    if (!mqttClient) return;
    
    mqttClient.subscribe(topic);
    mqttClient.on('message', (receivedTopic, message) => {
        if (receivedTopic === topic || receivedTopic.startsWith(topic.replace('+', ''))) {
            try {
                const data = JSON.parse(message.toString());
                callback(data, receivedTopic);
            } catch {
                callback(message.toString(), receivedTopic);
            }
        }
    });
};

const closeMQTT = async () => {
    if (mqttClient) {
        await mqttClient.end();
        console.log('MQTT connection closed');
    }
};

module.exports = {
    initMQTT,
    publishMQTT,
    subscribeMQTT,
    closeMQTT,
    getMQTTClient: () => mqttClient
};