/**
 * MQTT Integration Tests
 * Tests MQTT broker communication for ESP32 devices
 */

const mqtt = require('mqtt');
const mongoose = require('mongoose');
const Device = require('../../models/Device');

describe('MQTT Integration Tests', () => {
    let mqttClient;
    let testDevice;

    beforeAll(async () => {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/estif_test');
        
        mqttClient = mqtt.connect(process.env.MQTT_BROKER || 'mqtt://localhost:1883');
        await new Promise(resolve => mqttClient.on('connect', resolve));
    });

    afterAll(async () => {
        mqttClient.end();
        await mongoose.disconnect();
    });

    beforeEach(async () => {
        await Device.deleteMany({});
        
        testDevice = await Device.create({
            name: 'MQTT Test Device',
            type: 'light',
            gpio: 23,
            state: false,
            ownerId: new mongoose.Types.ObjectId()
        });
    });

    test('Should publish device state to MQTT', (done) => {
        const topic = `estif/device/${testDevice._id}/state`;
        
        mqttClient.subscribe(topic, (err) => {
            if (err) return done(err);
            
            mqttClient.publish(topic, JSON.stringify({ state: true }));
            
            mqttClient.once('message', (receivedTopic, message) => {
                expect(receivedTopic).toBe(topic);
                const data = JSON.parse(message.toString());
                expect(data.state).toBe(true);
                done();
            });
        });
    });

    test('Should receive ESP32 sensor data', (done) => {
        const topic = 'estif/sensor/temperature';
        
        mqttClient.subscribe(topic, () => {
            mqttClient.publish(topic, JSON.stringify({ temperature: 25.5, humidity: 65 }));
            
            mqttClient.once('message', (receivedTopic, message) => {
                const data = JSON.parse(message.toString());
                expect(data.temperature).toBe(25.5);
                done();
            });
        });
    });
});