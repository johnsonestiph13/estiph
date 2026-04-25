/**
 * ESTIF HOME ULTIMATE - ESP32 MAIN FIRMWARE
 * Smart Home Controller for ESP32 with WebSocket, MQTT, Bluetooth, and Auto Mode
 * Version: 2.0.0
 * Author: Estifanos Yohannis
 * 
 * Hardware:
 * - ESP32 Dev Board
 * - GPIO Pins: 23(Light), 22(Fan), 21(AC), 19(TV), 18(Heater), 5(Pump)
 * - DHT22 Temperature/Humidity Sensor (GPIO 4)
 * - LED Status Indicator (GPIO 2)
 * - Buzzer (GPIO 15)
 */

#include <Arduino.h>
#include <WiFi.h>
#include <WebSocketsClient.h>
#include <ArduinoJson.h>
#include <DHT.h>
#include <EEPROM.h>
#include <Preferences.h>
#include <esp_task_wdt.h>

// ============================================
// CONFIGURATION
// ============================================

// WiFi Configuration
const char* WIFI_SSID = "AB lakat";
const char* WIFI_PASSWORD = "Jon@2127se";

// WebSocket Server Configuration
const char* WS_HOST = "api.estif-home.com";
const uint16_t WS_PORT = 3000;
const char* WS_PATH = "/socket.io/?EIO=4&transport=websocket";

// MQTT Configuration (Fallback)
const char* MQTT_BROKER = "mqtt.estif-home.com";
const uint16_t MQTT_PORT = 1883;

// Device Configuration
#define DEVICE_ID "ESP32_001"
#define FIRMWARE_VERSION "2.0.0"

// GPIO Pins
#define PIN_LIGHT    23
#define PIN_FAN      22
#define PIN_AC       21
#define PIN_TV       19
#define PIN_HEATER   18
#define PIN_PUMP     5
#define PIN_DHT      4
#define PIN_LED      2
#define PIN_BUZZER   15

// DHT Sensor Type
#define DHT_TYPE DHT22

// Timing Constants
#define HEARTBEAT_INTERVAL    30000  // 30 seconds
#define RECONNECT_INTERVAL    5000   // 5 seconds
#define WDT_TIMEOUT           10     // 10 seconds
#define AUTO_MODE_CHECK       10000  // 10 seconds

// Temperature Thresholds
#define AC_ON_TEMP      26.0
#define AC_OFF_TEMP     24.0
#define HEATER_ON_TEMP  18.0
#define HEATER_OFF_TEMP 20.0
#define FAN_ON_TEMP     26.0
#define FAN_OFF_TEMP    24.0

// Schedule Times (24-hour format)
#define LIGHT_ON_HOUR   6
#define LIGHT_ON_MIN    30
#define LIGHT_OFF_HOUR  22
#define LIGHT_OFF_MIN   0

#define TV_ON_HOUR      8
#define TV_ON_MIN       0
#define TV_OFF_HOUR     22
#define TV_OFF_MIN      0

#define PUMP_ON_HOUR    10
#define PUMP_ON_MIN     0
#define PUMP_OFF_HOUR   16
#define PUMP_OFF_MIN    0

// ============================================
// GLOBAL VARIABLES
// ============================================

// WiFi Client
WiFiClient wifiClient;

// WebSocket Client
WebSocketsClient webSocket;

// DHT Sensor
DHT dht(PIN_DHT, DHT_TYPE);

// Preferences (Non-volatile storage)
Preferences preferences;

// Device States
struct Device {
  uint8_t pin;
  bool state;
  bool autoMode;
  uint16_t power;
  char name[16];
};

Device devices[] = {
  {PIN_LIGHT,  false, false, 10, "Light"},
  {PIN_FAN,    false, true,  40, "Fan"},
  {PIN_AC,     false, true,  120, "AC"},
  {PIN_TV,     false, false, 80, "TV"},
  {PIN_HEATER, false, true,  1500, "Heater"},
  {PIN_PUMP,   false, false, 250, "Pump"}
};

const int DEVICE_COUNT = 6;

// Sensor Data
float temperature = 23.0;
float humidity = 45.0;

// System Status
bool wsConnected = false;
bool mqttConnected = false;
unsigned long lastHeartbeat = 0;
unsigned long lastAutoModeCheck = 0;
unsigned long lastReconnectAttempt = 0;
uint32_t uptime = 0;

// LED State
bool ledState = false;
unsigned long lastLedBlink = 0;

// ============================================
// FUNCTION DECLARATIONS
// ============================================

void setupWiFi();
void setupWebSocket();
void setupMQTT();
void setupGPIO();
void setupPreferences();
void webSocketEvent(WStype_t type, uint8_t* payload, size_t length);
void sendHeartbeat();
void processAutoMode();
void checkSchedules();
void updateDeviceState(int index, bool state);
void updateAutoMode(int index, bool enabled);
void blinkLED(int times, int duration);
void buzzerBeep(int duration);
void saveDeviceStates();
void loadDeviceStates();
String getDeviceStatusJSON();
String getSystemStatusJSON();

// ============================================
// SETUP
// ============================================

void setup() {
  // Initialize Serial
  Serial.begin(115200);
  Serial.println("\n\n=========================================");
  Serial.println("ESTIF HOME ULTIMATE - ESP32 FIRMWARE v" FIRMWARE_VERSION);
  Serial.println("=========================================");
  
  // Initialize Watchdog Timer
  esp_task_wdt_init(WDT_TIMEOUT, true);
  esp_task_wdt_add(NULL);
  
  // Setup Components
  setupGPIO();
  setupPreferences();
  loadDeviceStates();
  
  // Initialize DHT Sensor
  dht.begin();
  Serial.println("[DHT] Sensor initialized");
  
  // Connect to WiFi
  setupWiFi();
  
  // Setup WebSocket
  setupWebSocket();
  
  // Initial LED blink
  blinkLED(3, 200);
  
  Serial.println("[MAIN] Setup complete, entering loop");
  esp_task_wdt_reset();
}

// ============================================
// MAIN LOOP
// ============================================

void loop() {
  // Keep Watchdog Alive
  esp_task_wdt_reset();
  
  // Handle WebSocket events
  if (wsConnected) {
    webSocket.loop();
  } else {
    // Attempt reconnection
    if (millis() - lastReconnectAttempt > RECONNECT_INTERVAL) {
      lastReconnectAttempt = millis();
      setupWebSocket();
    }
  }
  
  // Read sensors periodically
  static unsigned long lastSensorRead = 0;
  if (millis() - lastSensorRead > 5000) {
    readSensors();
    lastSensorRead = millis();
  }
  
  // Send heartbeat
  if (millis() - lastHeartbeat > HEARTBEAT_INTERVAL) {
    sendHeartbeat();
    lastHeartbeat = millis();
  }
  
  // Process auto mode
  if (millis() - lastAutoModeCheck > AUTO_MODE_CHECK) {
    processAutoMode();
    checkSchedules();
    lastAutoModeCheck = millis();
  }
  
  // Blink LED for connection status
  blinkStatusLED();
  
  // Update uptime
  uptime = millis() / 1000;
}

// ============================================
// WIFI SETUP
// ============================================

void setupWiFi() {
  Serial.print("[WiFi] Connecting to ");
  Serial.print(WIFI_SSID);
  
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 40) {
    delay(500);
    Serial.print(".");
    attempts++;
  }
  
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n[WiFi] Connected!");
    Serial.print("[WiFi] IP Address: ");
    Serial.println(WiFi.localIP());
    Serial.print("[WiFi] RSSI: ");
    Serial.println(WiFi.RSSI());
  } else {
    Serial.println("\n[WiFi] Connection failed!");
  }
}

// ============================================
// WEBSOCKET SETUP
// ============================================

void setupWebSocket() {
  webSocket.beginSSL(WS_HOST, WS_PORT, WS_PATH);
  webSocket.onEvent(webSocketEvent);
  webSocket.setReconnectInterval(5000);
  webSocket.enableHeartbeat(15000, 3000, 2);
  
  Serial.println("[WebSocket] Connecting...");
}

void webSocketEvent(WStype_t type, uint8_t* payload, size_t length) {
  switch(type) {
    case WStype_DISCONNECTED:
      wsConnected = false;
      Serial.println("[WebSocket] Disconnected");
      break;
      
    case WStype_CONNECTED:
      wsConnected = true;
      Serial.println("[WebSocket] Connected");
      // Send registration message
      sendRegistration();
      break;
      
    case WStype_TEXT:
      handleWebSocketMessage(payload);
      break;
      
    case WStype_ERROR:
      Serial.println("[WebSocket] Error");
      wsConnected = false;
      break;
      
    default:
      break;
  }
}

void handleWebSocketMessage(uint8_t* payload) {
  StaticJsonDocument<1024> doc;
  DeserializationError error = deserializeJson(doc, payload);
  
  if (error) {
    Serial.print("[WebSocket] JSON parse error: ");
    Serial.println(error.c_str());
    return;
  }
  
  const char* type = doc["type"];
  
  if (strcmp(type, "device_control") == 0) {
    int deviceId = doc["deviceId"];
    bool state = doc["state"];
    
    if (deviceId >= 0 && deviceId < DEVICE_COUNT) {
      updateDeviceState(deviceId, state);
    }
  }
  else if (strcmp(type, "auto_mode") == 0) {
    int deviceId = doc["deviceId"];
    bool enabled = doc["enabled"];
    
    if (deviceId >= 0 && deviceId < DEVICE_COUNT) {
      updateAutoMode(deviceId, enabled);
    }
  }
  else if (strcmp(type, "master_control") == 0) {
    bool state = doc["state"];
    for (int i = 0; i < DEVICE_COUNT; i++) {
      if (!devices[i].autoMode) {
        updateDeviceState(i, state);
      }
    }
  }
  else if (strcmp(type, "ping") == 0) {
    sendPong();
  }
}

// ============================================
// DEVICE CONTROL
// ============================================

void setupGPIO() {
  // Initialize device pins
  for (int i = 0; i < DEVICE_COUNT; i++) {
    pinMode(devices[i].pin, OUTPUT);
    digitalWrite(devices[i].pin, LOW);
  }
  
  // Initialize LED and Buzzer
  pinMode(PIN_LED, OUTPUT);
  pinMode(PIN_BUZZER, OUTPUT);
  digitalWrite(PIN_LED, LOW);
  digitalWrite(PIN_BUZZER, LOW);
  
  Serial.println("[GPIO] Initialized");
}

void updateDeviceState(int index, bool state) {
  if (devices[index].state == state) return;
  
  devices[index].state = state;
  digitalWrite(devices[index].pin, state ? HIGH : LOW);
  
  Serial.printf("[Device] %s turned %s\n", 
    devices[index].name, 
    state ? "ON" : "OFF");
  
  // Save to EEPROM
  saveDeviceStates();
  
  // Send update to server
  sendDeviceUpdate(index);
}

void updateAutoMode(int index, bool enabled) {
  if (devices[index].autoMode == enabled) return;
  
  devices[index].autoMode = enabled;
  Serial.printf("[Device] %s auto mode %s\n", 
    devices[index].name, 
    enabled ? "enabled" : "disabled");
  
  saveDeviceStates();
  sendDeviceUpdate(index);
}

void updateAllDevices(bool state) {
  for (int i = 0; i < DEVICE_COUNT; i++) {
    if (!devices[i].autoMode) {
      updateDeviceState(i, state);
    }
  }
}

// ============================================
// AUTO MODE LOGIC
// ============================================

void processAutoMode() {
  // Fan Auto Mode (Temperature based)
  if (devices[1].autoMode) {
    if (temperature >= FAN_ON_TEMP && !devices[1].state) {
      updateDeviceState(1, true);
      Serial.println("[Auto] Fan turned ON due to temperature");
    } else if (temperature <= FAN_OFF_TEMP && devices[1].state) {
      updateDeviceState(1, false);
      Serial.println("[Auto] Fan turned OFF due to temperature");
    }
  }
  
  // AC Auto Mode (Temperature based)
  if (devices[2].autoMode) {
    if (temperature >= AC_ON_TEMP && !devices[2].state) {
      updateDeviceState(2, true);
      Serial.println("[Auto] AC turned ON due to temperature");
    } else if (temperature <= AC_OFF_TEMP && devices[2].state) {
      updateDeviceState(2, false);
      Serial.println("[Auto] AC turned OFF due to temperature");
    }
  }
  
  // Heater Auto Mode (Temperature based)
  if (devices[4].autoMode) {
    if (temperature <= HEATER_ON_TEMP && !devices[4].state) {
      updateDeviceState(4, true);
      Serial.println("[Auto] Heater turned ON due to temperature");
    } else if (temperature >= HEATER_OFF_TEMP && devices[4].state) {
      updateDeviceState(4, false);
      Serial.println("[Auto] Heater turned OFF due to temperature");
    }
  }
}

void checkSchedules() {
  time_t now = time(nullptr);
  struct tm* timeinfo = localtime(&now);
  int currentHour = timeinfo->tm_hour;
  int currentMinute = timeinfo->tm_min;
  
  // Light Schedule
  if (!devices[0].autoMode) {
    // Morning ON
    if (currentHour == LIGHT_ON_HOUR && currentMinute == LIGHT_ON_MIN && !devices[0].state) {
      updateDeviceState(0, true);
      Serial.println("[Schedule] Morning light turned ON");
    }
    // Night OFF
    if (currentHour == LIGHT_OFF_HOUR && currentMinute == LIGHT_OFF_MIN && devices[0].state) {
      updateDeviceState(0, false);
      Serial.println("[Schedule] Night light turned OFF");
    }
  }
  
  // TV Schedule
  if (!devices[3].autoMode) {
    if (currentHour == TV_ON_HOUR && currentMinute == TV_ON_MIN && !devices[3].state) {
      updateDeviceState(3, true);
      Serial.println("[Schedule] TV turned ON");
    }
    if (currentHour == TV_OFF_HOUR && currentMinute == TV_OFF_MIN && devices[3].state) {
      updateDeviceState(3, false);
      Serial.println("[Schedule] TV turned OFF");
    }
  }
  
  // Pump Schedule
  if (!devices[5].autoMode) {
    if (currentHour == PUMP_ON_HOUR && currentMinute == PUMP_ON_MIN && !devices[5].state) {
      updateDeviceState(5, true);
      Serial.println("[Schedule] Pump turned ON");
    }
    if (currentHour == PUMP_OFF_HOUR && currentMinute == PUMP_OFF_MIN && devices[5].state) {
      updateDeviceState(5, false);
      Serial.println("[Schedule] Pump turned OFF");
    }
  }
}

// ============================================
// SENSOR READING
// ============================================

void readSensors() {
  float newTemp = dht.readTemperature();
  float newHum = dht.readHumidity();
  
  if (!isnan(newTemp)) {
    temperature = newTemp;
  }
  
  if (!isnan(newHum)) {
    humidity = newHum;
  }
  
  Serial.printf("[Sensor] Temperature: %.1f°C, Humidity: %.1f%%\n", temperature, humidity);
}

// ============================================
// WEB SOCKET MESSAGES
// ============================================

void sendRegistration() {
  StaticJsonDocument<512> doc;
  doc["type"] = "register_esp";
  doc["ip"] = WiFi.localIP().toString();
  doc["name"] = DEVICE_ID;
  doc["mac"] = WiFi.macAddress();
  doc["version"] = FIRMWARE_VERSION;
  
  String output;
  serializeJson(doc, output);
  webSocket.sendTXT(output);
  
  Serial.println("[WebSocket] Registration sent");
}

void sendHeartbeat() {
  if (!wsConnected) return;
  
  StaticJsonDocument<512> doc;
  doc["type"] = "heartbeat";
  doc["timestamp"] = millis();
  doc["uptime"] = uptime;
  
  // Add device states
  JsonArray devicesArray = doc.createNestedArray("devices");
  for (int i = 0; i < DEVICE_COUNT; i++) {
    JsonObject device = devicesArray.createNestedObject();
    device["id"] = i;
    device["state"] = devices[i].state;
    device["autoMode"] = devices[i].autoMode;
  }
  
  // Add sensor data
  doc["temperature"] = temperature;
  doc["humidity"] = humidity;
  
  String output;
  serializeJson(doc, output);
  webSocket.sendTXT(output);
  
  Serial.println("[WebSocket] Heartbeat sent");
}

void sendDeviceUpdate(int index) {
  if (!wsConnected) return;
  
  StaticJsonDocument<256> doc;
  doc["type"] = "device_update";
  doc["deviceId"] = index;
  doc["state"] = devices[index].state;
  doc["autoMode"] = devices[index].autoMode;
  doc["timestamp"] = millis();
  
  String output;
  serializeJson(doc, output);
  webSocket.sendTXT(output);
}

void sendPong() {
  if (!wsConnected) return;
  
  StaticJsonDocument<128> doc;
  doc["type"] = "pong";
  doc["timestamp"] = millis();
  
  String output;
  serializeJson(doc, output);
  webSocket.sendTXT(output);
}

// ============================================
// PREFERENCES STORAGE
// ============================================

void setupPreferences() {
  preferences.begin("estif", false);
  Serial.println("[EEPROM] Preferences initialized");
}

void saveDeviceStates() {
  for (int i = 0; i < DEVICE_COUNT; i++) {
    String key = "dev" + String(i);
    preferences.putBool(key.c_str(), devices[i].state);
    
    String autoKey = "auto" + String(i);
    preferences.putBool(autoKey.c_str(), devices[i].autoMode);
  }
  
  Serial.println("[EEPROM] Device states saved");
}

void loadDeviceStates() {
  for (int i = 0; i < DEVICE_COUNT; i++) {
    String key = "dev" + String(i);
    devices[i].state = preferences.getBool(key.c_str(), devices[i].state);
    digitalWrite(devices[i].pin, devices[i].state ? HIGH : LOW);
    
    String autoKey = "auto" + String(i);
    devices[i].autoMode = preferences.getBool(autoKey.c_str(), devices[i].autoMode);
  }
  
  Serial.println("[EEPROM] Device states loaded");
}

// ============================================
// LED & BUZZER CONTROL
// ============================================

void blinkLED(int times, int duration) {
  for (int i = 0; i < times; i++) {
    digitalWrite(PIN_LED, HIGH);
    delay(duration);
    digitalWrite(PIN_LED, LOW);
    delay(duration);
  }
}

void blinkStatusLED() {
  unsigned long now = millis();
  if (wsConnected) {
    // Fast blink when connected
    if (now - lastLedBlink > 1000) {
      ledState = !ledState;
      digitalWrite(PIN_LED, ledState);
      lastLedBlink = now;
    }
  } else {
    // Slow blink when disconnected
    if (now - lastLedBlink > 500) {
      ledState = !ledState;
      digitalWrite(PIN_LED, ledState);
      lastLedBlink = now;
    }
  }
}

void buzzerBeep(int duration) {
  digitalWrite(PIN_BUZZER, HIGH);
  delay(duration);
  digitalWrite(PIN_BUZZER, LOW);
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

String getDeviceStatusJSON() {
  StaticJsonDocument<1024> doc;
  JsonArray devicesArray = doc.createNestedArray("devices");
  
  for (int i = 0; i < DEVICE_COUNT; i++) {
    JsonObject device = devicesArray.createNestedObject();
    device["id"] = i;
    device["name"] = devices[i].name;
    device["pin"] = devices[i].pin;
    device["state"] = devices[i].state;
    device["autoMode"] = devices[i].autoMode;
    device["power"] = devices[i].power;
  }
  
  String output;
  serializeJson(doc, output);
  return output;
}

String getSystemStatusJSON() {
  StaticJsonDocument<512> doc;
  doc["deviceId"] = DEVICE_ID;
  doc["version"] = FIRMWARE_VERSION;
  doc["uptime"] = uptime;
  doc["wifi_rssi"] = WiFi.RSSI();
  doc["ws_connected"] = wsConnected;
  doc["temperature"] = temperature;
  doc["humidity"] = humidity;
  doc["free_heap"] = ESP.getFreeHeap();
  doc["free_psram"] = ESP.getFreePsram();
  
  String output;
  serializeJson(doc, output);
  return output;
}

// ============================================
// COMMAND PROCESSOR (For Serial Debug)
// ============================================

void processSerialCommand() {
  if (!Serial.available()) return;
  
  String command = Serial.readStringUntil('\n');
  command.trim();
  command.toLowerCase();
  
  if (command == "status") {
    Serial.println(getSystemStatusJSON());
    Serial.println(getDeviceStatusJSON());
  }
  else if (command == "reset") {
    Serial.println("Resetting device...");
    ESP.restart();
  }
  else if (command.startsWith("device")) {
    int spaceIndex = command.indexOf(' ');
    if (spaceIndex != -1) {
      int deviceId = command.substring(spaceIndex + 1).toInt();
      if (deviceId >= 0 && deviceId < DEVICE_COUNT) {
        updateDeviceState(deviceId, !devices[deviceId].state);
        Serial.printf("Toggled device %d\n", deviceId);
      }
    }
  }
  else if (command == "help") {
    Serial.println("Commands:");
    Serial.println("  status - Show system status");
    Serial.println("  reset - Restart ESP32");
    Serial.println("  device <id> - Toggle device");
    Serial.println("  help - Show this help");
  }
}

// ============================================
// OTA UPDATE HANDLER (Optional)
// ============================================

// Uncomment to enable OTA updates
/*
#include <ArduinoOTA.h>

void setupOTA() {
  ArduinoOTA.setHostname(DEVICE_ID);
  ArduinoOTA.setPassword("estif2024");
  
  ArduinoOTA.onStart([]() {
    String type;
    if (ArduinoOTA.getCommand() == U_FLASH) {
      type = "sketch";
    } else {
      type = "filesystem";
    }
    Serial.println("Start updating " + type);
  });
  
  ArduinoOTA.onEnd([]() {
    Serial.println("\nUpdate complete");
  });
  
  ArduinoOTA.onProgress([](unsigned int progress, unsigned int total) {
    Serial.printf("Progress: %u%%\r", (progress / (total / 100)));
  });
  
  ArduinoOTA.onError([](ota_error_t error) {
    Serial.printf("Error[%u]: ", error);
    if (error == OTA_AUTH_ERROR) Serial.println("Auth Failed");
    else if (error == OTA_BEGIN_ERROR) Serial.println("Begin Failed");
    else if (error == OTA_CONNECT_ERROR) Serial.println("Connect Failed");
    else if (error == OTA_RECEIVE_ERROR) Serial.println("Receive Failed");
    else if (error == OTA_END_ERROR) Serial.println("End Failed");
  });
  
  ArduinoOTA.begin();
  Serial.println("[OTA] Ready");
}

// Add to loop():
// ArduinoOTA.handle();
*/