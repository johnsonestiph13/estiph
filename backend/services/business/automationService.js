/**
 * ESTIF HOME ULTIMATE - AUTOMATION SERVICE
 * Automation rules business logic
 * Version: 2.0.0
 */

const Automation = require('../../models/Automation');
const Device = require('../../models/Device');
const ActivityLog = require('../../models/ActivityLog');
const { logger } = require('../../utils/logger');

class AutomationService {
    async createRule(userId, data) {
        const rule = await Automation.create({ ...data, userId });
        await ActivityLog.create({ userId, action: 'automation_created', entityType: 'automation', entityId: rule._id });
        return rule;
    }

    async updateRule(ruleId, userId, updates) {
        const rule = await Automation.findOne({ _id: ruleId, userId });
        if (!rule) throw new Error('Rule not found');
        
        Object.assign(rule, updates, { updatedAt: new Date() });
        await rule.save();
        
        await ActivityLog.create({ userId, action: 'automation_updated', entityType: 'automation', entityId: rule._id });
        return rule;
    }

    async deleteRule(ruleId, userId) {
        const rule = await Automation.findOne({ _id: ruleId, userId });
        if (!rule) throw new Error('Rule not found');
        
        await rule.deleteOne();
        await ActivityLog.create({ userId, action: 'automation_deleted', entityType: 'automation', entityId: ruleId });
        return true;
    }

    async toggleRule(ruleId, userId, enabled) {
        const rule = await Automation.findOne({ _id: ruleId, userId });
        if (!rule) throw new Error('Rule not found');
        
        rule.enabled = enabled;
        await rule.save();
        
        await ActivityLog.create({ userId, action: enabled ? 'automation_enabled' : 'automation_disabled', entityType: 'automation', entityId: rule._id });
        return rule;
    }

    async evaluateRule(rule, context) {
        const { trigger, condition } = rule;
        
        // Evaluate trigger
        let triggered = false;
        switch (trigger.type) {
            case 'schedule':
                triggered = this.evaluateSchedule(trigger.config, context.time);
                break;
            case 'temperature':
                triggered = this.evaluateTemperature(trigger.config, context.temperature);
                break;
            case 'device_state':
                triggered = await this.evaluateDeviceState(trigger.config, context.devices);
                break;
        }
        
        if (!triggered) return false;
        
        // Evaluate condition if present
        if (condition && condition.type !== 'none') {
            const conditionMet = await this.evaluateCondition(condition, context);
            if (!conditionMet) return false;
        }
        
        // Execute action
        await this.executeAction(rule.action, context);
        
        rule.lastTriggered = new Date();
        rule.triggerCount++;
        await rule.save();
        
        return true;
    }

    evaluateSchedule(config, currentTime) {
        const { time, days } = config;
        const currentHour = currentTime.getHours();
        const currentMinute = currentTime.getMinutes();
        const [hour, minute] = time.split(':').map(Number);
        
        const timeMatch = currentHour === hour && currentMinute === minute;
        const dayMatch = days.includes(currentTime.getDay());
        
        return timeMatch && dayMatch;
    }

    evaluateTemperature(config, temperature) {
        const { operator, value } = config;
        switch (operator) {
            case '>': return temperature > value;
            case '<': return temperature < value;
            case '>=': return temperature >= value;
            case '<=': return temperature <= value;
            default: return false;
        }
    }

    async evaluateDeviceState(config, devices) {
        const { deviceId, state } = config;
        const device = devices.find(d => d.id === deviceId);
        return device && device.state === state;
    }

    async evaluateCondition(condition, context) {
        const { type, config } = condition;
        switch (type) {
            case 'time':
                return this.evaluateSchedule(config, context.time);
            case 'temperature':
                return this.evaluateTemperature(config, context.temperature);
            case 'device_state':
                return await this.evaluateDeviceState(config, context.devices);
            default:
                return true;
        }
    }

    async executeAction(action, context) {
        const { type, config } = action;
        const device = await Device.findById(config.deviceId);
        if (!device) return false;
        
        switch (type) {
            case 'device_on':
                if (!device.autoMode) device.state = true;
                break;
            case 'device_off':
                if (!device.autoMode) device.state = false;
                break;
            case 'device_toggle':
                if (!device.autoMode) device.state = !device.state;
                break;
            case 'notification':
                // Send notification
                break;
        }
        
        if (device.isModified()) await device.save();
        return true;
    }

    async getUserRules(userId) {
        return await Automation.find({ userId });
    }

    async getEnabledRules() {
        return await Automation.find({ enabled: true });
    }
}

module.exports = new AutomationService();