/**
 * ESTIF HOME ULTIMATE - COMMAND PROCESSOR MODULE
 * Natural language command processing for device control
 * Version: 2.0.0
 * Author: Estifanos Yohannis
 */

// ============================================
// COMMAND PROCESSOR CONFIGURATION
// ============================================

const CommandProcessorConfig = {
    // Command patterns
    patterns: {
        device_control: {
            en: [
                /turn (on|off) the (\w+)/i,
                /switch (on|off) (\w+)/i,
                /(\w+) (on|off)/i,
                /(?:please )?(?:can you )?turn (on|off) (?:the )?(\w+)/i
            ],
            am: [
                /(\w+) (አብራ|አጥፋ)/i,
                /(አብራ|አጥፋ) (\w+)/i
            ]
        },
        master_control: {
            en: [
                /turn (on|off) (?:all|everything)/i,
                /(?:please )?(?:can you )?turn (on|off) (?:all|everything)/i
            ],
            am: [
                /ሁሉንም (አብራ|አጥፋ)/i,
                /(አብራ|አጥፋ) ሁሉንም/i
            ]
        },
        query: {
            en: [
                /what is the (temperature|humidity)/i,
                /(?:tell me )?(?:the )?(temperature|humidity)/i,
                /how (hot|cold) is it/i,
                /what's the (temperature|humidity)/i
            ],
            am: [
                /ሙቀቱ (ስንት ነው|ምን ያህል ነው)/i,
                /እርጥበቱ (ስንት ነው|ምን ያህል ነው)/i
            ]
        },
        auto_mode: {
            en: [
                /(enable|disable) auto mode for (\w+)/i,
                /turn (on|off) auto mode (?:for )?(\w+)/i,
                /(\w+) auto mode (on|off)/i
            ],
            am: [
                /(\w+) (አውቶማቲክ አብራ|አውቶማቲክ አጥፋ)/i,
                /(አውቶማቲክ አብራ|አውቶማቲክ አጥፋ) (\w+)/i
            ]
        },
        scene: {
            en: [
                /activate (.*) scene/i,
                /turn on (.*) mode/i,
                /set (.*) scene/i
            ],
            am: [
                /(.*) ሁነታ አብራ/i,
                /(.*) ስኬን አብራ/i
            ]
        },
        schedule: {
            en: [
                /schedule (\w+) to turn (on|off) at (.*)/i,
                /set (\w+) to (on|off) at (.*)/i
            ],
            am: [
                /(\w+) በ(.*) (አብራ|አጥፋ)/i
            ]
        }
    },
    
    // Device name mapping
    deviceMap: {
        en: {
            light: 0, lamp: 0, lights: 0,
            fan: 1, fans: 1,
            ac: 2, aircon: 2, airconditioner: 2, airconditioner: 2,
            tv: 3, television: 3,
            heater: 4, heaters: 4,
            pump: 5, pumps: 5
        },
        am: {
            'መብራት': 0, 'መብራቶች': 0,
            'ማራገቢያ': 1, 'ማራገቢያዎች': 1,
            'ኤሲ': 2, 'አየር ማቀዝቀዣ': 2,
            'ቲቪ': 3, 'ቴሌቪዥን': 3,
            'ማሞቂያ': 4,
            'ፓምፕ': 5
        }
    },
    
    // Debug
    debug: false
};

// ============================================
// COMMAND PROCESSOR
// ============================================

class CommandProcessor {
    constructor(deviceController, sceneManager) {
        this.deviceController = deviceController;
        this.sceneManager = sceneManager;
        self.commandHistory = [];
        self.listeners = [];
        
        this.init();
    }

    init() {
        CommandProcessorConfig.debug && console.log('[CommandProcessor] Initialized');
    }

    // ============================================
    // COMMAND PROCESSING
    // ============================================

    async processCommand(text, language = 'en') {
        const command = this.parseCommand(text, language);
        
        if (!command) {
            this.notifyListeners('unknown_command', { text, language });
            return { success: false, error: 'Unknown command' };
        }
        
        // Record history
        this.recordHistory(text, command);
        
        // Execute command
        const result = await this.executeCommand(command);
        
        this.notifyListeners('command_processed', { command, result, text });
        
        return result;
    }

    parseCommand(text, language = 'en') {
        const normalizedText = text.toLowerCase().trim();
        const patterns = CommandProcessorConfig.patterns;
        
        // Check device control
        for (const pattern of patterns.device_control[language]) {
            const match = normalizedText.match(pattern);
            if (match) {
                return this.parseDeviceCommand(match, language);
            }
        }
        
        // Check master control
        for (const pattern of patterns.master_control[language]) {
            const match = normalizedText.match(pattern);
            if (match) {
                return this.parseMasterCommand(match);
            }
        }
        
        // Check query
        for (const pattern of patterns.query[language]) {
            const match = normalizedText.match(pattern);
            if (match) {
                return this.parseQueryCommand(match);
            }
        }
        
        // Check auto mode
        for (const pattern of patterns.auto_mode[language]) {
            const match = normalizedText.match(pattern);
            if (match) {
                return this.parseAutoModeCommand(match, language);
            }
        }
        
        // Check scene
        for (const pattern of patterns.scene[language]) {
            const match = normalizedText.match(pattern);
            if (match) {
                return this.parseSceneCommand(match, language);
            }
        }
        
        // Check schedule
        for (const pattern of patterns.schedule[language]) {
            const match = normalizedText.match(pattern);
            if (match) {
                return this.parseScheduleCommand(match, language);
            }
        }
        
        return null;
    }

    parseDeviceCommand(match, language) {
        let action, deviceName;
        
        if (match[1] === 'on' || match[1] === 'off' || match[1] === 'አብራ' || match[1] === 'አጥፋ') {
            action = match[1];
            deviceName = match[2];
        } else if (match[2] === 'on' || match[2] === 'off' || match[2] === 'አብራ' || match[2] === 'አጥፋ') {
            action = match[2];
            deviceName = match[1];
        } else {
            action = match[2];
            deviceName = match[1];
        }
        
        const deviceId = this.getDeviceId(deviceName, language);
        if (deviceId === undefined) return null;
        
        return {
            type: 'device_control',
            deviceId,
            action: action === 'on' || action === 'አብራ' ? 'on' : 'off'
        };
    }

    parseMasterCommand(match) {
        const action = match[1];
        return {
            type: 'master_control',
            action: action === 'on' ? 'all_on' : 'all_off'
        };
    }

    parseQueryCommand(match) {
        const query = match[1];
        return {
            type: 'query',
            query: query === 'temperature' ? 'temperature' : 'humidity'
        };
    }

    parseAutoModeCommand(match, language) {
        let enabled, deviceName;
        
        if (match[1] === 'enable' || match[1] === 'on' || match[1] === 'አብራ') {
            enabled = true;
            deviceName = match[2];
        } else if (match[2] === 'enable' || match[2] === 'on' || match[2] === 'አብራ') {
            enabled = true;
            deviceName = match[1];
        } else if (match[1] === 'disable' || match[1] === 'off' || match[1] === 'አጥፋ') {
            enabled = false;
            deviceName = match[2];
        } else {
            enabled = match[2] === 'on' || match[2] === 'አብራ';
            deviceName = match[1];
        }
        
        const deviceId = this.getDeviceId(deviceName, language);
        if (deviceId === undefined) return null;
        
        return {
            type: 'auto_mode',
            deviceId,
            enabled
        };
    }

    parseSceneCommand(match, language) {
        const sceneName = match[1];
        return {
            type: 'scene',
            sceneName: sceneName.trim()
        };
    }

    parseScheduleCommand(match, language) {
        const deviceName = match[1];
        const action = match[2] === 'on' || match[2] === 'አብራ' ? 'on' : 'off';
        const time = match[3];
        
        const deviceId = this.getDeviceId(deviceName, language);
        if (deviceId === undefined) return null;
        
        return {
            type: 'schedule',
            deviceId,
            action,
            time
        };
    }

    // ============================================
    // COMMAND EXECUTION
    // ============================================

    async executeCommand(command) {
        switch (command.type) {
            case 'device_control':
                return await this.executeDeviceCommand(command);
            case 'master_control':
                return await this.executeMasterCommand(command);
            case 'query':
                return await this.executeQueryCommand(command);
            case 'auto_mode':
                return await this.executeAutoModeCommand(command);
            case 'scene':
                return await this.executeSceneCommand(command);
            case 'schedule':
                return await this.executeScheduleCommand(command);
            default:
                return { success: false, error: 'Unknown command type' };
        }
    }

    async executeDeviceCommand(command) {
        try {
            if (command.action === 'on') {
                await this.deviceController.turnOn(command.deviceId);
            } else {
                await this.deviceController.turnOff(command.deviceId);
            }
            return { success: true, message: `Device ${command.action} successfully` };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async executeMasterCommand(command) {
        try {
            if (command.action === 'all_on') {
                await this.deviceController.masterAllOn();
            } else {
                await this.deviceController.masterAllOff();
            }
            return { success: true, message: `All devices turned ${command.action === 'all_on' ? 'on' : 'off'}` };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async executeQueryCommand(command) {
        const stats = this.deviceController.getSystemStats();
        if (command.query === 'temperature') {
            return { success: true, message: `The temperature is ${stats.temperature}°C` };
        } else {
            return { success: true, message: `The humidity is ${stats.humidity}%` };
        }
    }

    async executeAutoModeCommand(command) {
        try {
            await this.deviceController.setAutoMode(command.deviceId, command.enabled);
            return { success: true, message: `Auto mode ${command.enabled ? 'enabled' : 'disabled'} for device` };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async executeSceneCommand(command) {
        try {
            await this.sceneManager.activateScene(command.sceneName);
            return { success: true, message: `Scene ${command.sceneName} activated` };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async executeScheduleCommand(command) {
        try {
            await this.deviceController.scheduleDevice(command.deviceId, command.action, command.time);
            return { success: true, message: `Device scheduled to turn ${command.action} at ${command.time}` };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // ============================================
    // UTILITY METHODS
    // ============================================

    getDeviceId(deviceName, language) {
        const map = CommandProcessorConfig.deviceMap[language];
        if (!map) return undefined;
        
        // Direct match
        if (map[deviceName] !== undefined) {
            return map[deviceName];
        }
        
        // Fuzzy match
        for (const [key, id] of Object.entries(map)) {
            if (deviceName.includes(key) || key.includes(deviceName)) {
                return id;
            }
        }
        
        return undefined;
    }

    recordHistory(text, command) {
        this.commandHistory.unshift({
            text,
            command,
            timestamp: Date.now()
        });
        
        if (this.commandHistory.length > 100) {
            this.commandHistory.pop();
        }
    }

    getCommandHistory(limit = 20) {
        return this.commandHistory.slice(0, limit);
    }

    clearHistory() {
        this.commandHistory = [];
    }

    // ============================================
    // EVENT SYSTEM
    // ============================================

    addEventListener(event, callback) {
        this.listeners.push({ event, callback });
        return () => {
            const index = this.listeners.findIndex(l => l.event === event && l.callback === callback);
            if (index !== -1) this.listeners.splice(index, 1);
        };
    }

    notifyListeners(event, data) {
        this.listeners.forEach(listener => {
            if (listener.event === event) {
                listener.callback(data);
            }
        });
    }
}

// ============================================
// CREATE SINGLETON INSTANCE
// ============================================

let commandProcessor = null;

const initCommandProcessor = (deviceController, sceneManager) => {
    commandProcessor = new CommandProcessor(deviceController, sceneManager);
    return commandProcessor;
};

// Expose globally
window.CommandProcessor = CommandProcessor;
window.initCommandProcessor = initCommandProcessor;

export { commandProcessor, CommandProcessor, CommandProcessorConfig, initCommandProcessor };