/*
  esp32_arm.servo_original.ino
  Real servo MQTT firmware for the gesture-controlled robotic arm.

  Current project flow:
    Python detects gesture -> arm/gesture
    NestJS maps gesture -> arm/command
    ESP32 receives arm/command -> executes servo sequence

  MQTT broker:
    Shiftr Desktop on PC: update MQTT_BROKER below before uploading

  Required Arduino libraries:
    ArduinoJson
    PubSubClient
    Adafruit PWM Servo Driver
*/

#include <Arduino.h>
#include <ArduinoJson.h>
#include <WiFi.h>
#include <PubSubClient.h>
#include <Wire.h>
#include <Adafruit_PWMServoDriver.h>

#define SERIAL_BAUD 115200
#define JSON_BUF_SIZE 4096
#define WIFI_RETRY_LIMIT 30
#define MQTT_RETRY_MS 3000

#define SERVOMIN 170
#define SERVOMAX 650
#define SERVO_STEP_DELAY_MS 8

#define STEP_PIN 27
#define DIR_PIN 26
#define BASE_STEPS_PER_DEGREE 1.6667
#define BASE_STEP_PULSE_US 700

#ifndef LED_BUILTIN
#define LED_BUILTIN 2
#endif

const char* WIFI_SSID = "YOUR_WIFI_SSID";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";

const char* MQTT_BROKER = "172.20.10.4";
const int MQTT_PORT = 1883;
const char* MQTT_CLIENT_ID = "esp32_arm_servo";

const char* TOPIC_ARM_COMMAND = "arm/command";
const char* TOPIC_APP_CONTROL = "arm/control";
const char* TOPIC_ESP32_COMMAND = "arm/esp32/command";
const char* TOPIC_ARM_STATUS = "arm/status";
const char* TOPIC_ESP32_STATUS = "arm/esp32/status";
const char* TOPIC_ARM_ACTIVITY = "arm/activity";
const char* TOPIC_ESP32_LOG = "arm/esp32/log";

Adafruit_PWMServoDriver pwm = Adafruit_PWMServoDriver();
WiFiClient wifiClient;
PubSubClient mqttClient(wifiClient);

struct ArmPosition {
  int base = 90;
  int shoulder = 90;
  int elbow = 90;
  int forearm = 90;
  int wrist = 90;
  int gripper = 0;
};

ArmPosition currentPos;
String currentGesture = "NONE";
String currentMovement = "Aucun";
String currentAction = "idle";
bool stopRequested = false;
unsigned long commandsReceived = 0;
unsigned long lastStatusMs = 0;
unsigned long lastMqttReconnectAttempt = 0;

enum ServoIndex {
  SERVO_SHOULDER_A = 0,
  SERVO_SHOULDER_B = 1,
  SERVO_ELBOW = 2,
  SERVO_FOREARM = 3,
  SERVO_WRIST = 4,
  SERVO_GRIPPER = 5,
  SERVO_COUNT = 6
};

const int servoPins[SERVO_COUNT] = {
  0, // shoulder servo A PCA9685 channel
  1, // shoulder servo B PCA9685 channel
  2, // elbow PCA9685 channel
  3, // forearm PCA9685 channel
  4, // wrist PCA9685 channel
  5  // gripper PCA9685 channel
};

int servoAngles[SERVO_COUNT] = {90, 90, 90, 90, 90, 0};

int clampInt(int value, int minVal, int maxVal) {
  return max(minVal, min(maxVal, value));
}

int angleToPulse(int angle) {
  return map(clampInt(angle, 0, 180), 0, 180, SERVOMIN, SERVOMAX);
}

void blinkLed(int count, int onMs = 70, int offMs = 70) {
  for (int i = 0; i < count; i++) {
    digitalWrite(LED_BUILTIN, HIGH);
    delay(onMs);
    digitalWrite(LED_BUILTIN, LOW);
    delay(offMs);
  }
}

void moveServo(int servoIndex, int targetAngle) {
  if (servoIndex < 0 || servoIndex >= SERVO_COUNT) return;

  int maxAngle = servoIndex == SERVO_GRIPPER ? 90 : 180;
  targetAngle = clampInt(targetAngle, 0, maxAngle);
  int currentAngle = servoAngles[servoIndex];
  int direction = targetAngle > currentAngle ? 1 : -1;

  for (int angle = currentAngle; angle != targetAngle; angle += direction) {
    if (stopRequested) break;
    servoAngles[servoIndex] = angle;
    pwm.setPWM(servoPins[servoIndex], 0, angleToPulse(angle));
    mqttClient.loop();
    if (stopRequested) break;
    yield();
    delay(SERVO_STEP_DELAY_MS);
  }

  if (!stopRequested) {
    servoAngles[servoIndex] = targetAngle;
    pwm.setPWM(servoPins[servoIndex], 0, angleToPulse(targetAngle));
  }
}

void moveShoulderPair(int targetAngle) {
  targetAngle = clampInt(targetAngle, 0, 180);
  int targetA = targetAngle;
  int targetB = 180 - targetAngle;
  int currentA = servoAngles[SERVO_SHOULDER_A];
  int currentB = servoAngles[SERVO_SHOULDER_B];

  while (currentA != targetA || currentB != targetB) {
    if (stopRequested) break;
    if (currentA != targetA) {
      currentA += targetA > currentA ? 1 : -1;
      servoAngles[SERVO_SHOULDER_A] = currentA;
      pwm.setPWM(servoPins[SERVO_SHOULDER_A], 0, angleToPulse(currentA));
    }

    if (currentB != targetB) {
      currentB += targetB > currentB ? 1 : -1;
      servoAngles[SERVO_SHOULDER_B] = currentB;
      pwm.setPWM(servoPins[SERVO_SHOULDER_B], 0, angleToPulse(currentB));
    }

    mqttClient.loop();
    if (stopRequested) break;
    yield();
    delay(SERVO_STEP_DELAY_MS);
  }

  if (!stopRequested) currentPos.shoulder = targetAngle;
}

void moveBaseStepper(int targetAngle) {
  targetAngle = clampInt(targetAngle, 0, 180);
  int delta = targetAngle - currentPos.base;
  if (delta == 0) return;

  digitalWrite(DIR_PIN, delta > 0 ? HIGH : LOW);
  long steps = (long)round(abs(delta) * BASE_STEPS_PER_DEGREE);

  for (long step = 0; step < steps; step++) {
    if (stopRequested) break;
    digitalWrite(STEP_PIN, HIGH);
    delayMicroseconds(BASE_STEP_PULSE_US);
    digitalWrite(STEP_PIN, LOW);
    delayMicroseconds(BASE_STEP_PULSE_US);

    if (step % 25 == 0) {
      mqttClient.loop();
      if (stopRequested) break;
      yield();
    }
  }

  if (!stopRequested) currentPos.base = targetAngle;
}

void publishText(const char* topic, const String& payload) {
  if (mqttClient.connected()) {
    mqttClient.publish(topic, payload.c_str());
  }
}

void addPosition(JsonDocument& doc) {
  JsonObject pos = doc["pos"].to<JsonObject>();
  pos["base"] = currentPos.base;
  pos["shoulder"] = currentPos.shoulder;
  pos["elbow"] = currentPos.elbow;
  pos["forearm"] = currentPos.forearm;
  pos["wrist"] = currentPos.wrist;
  pos["gripper"] = currentPos.gripper;
}

void sendStatus(const char* status, const char* msg = nullptr) {
  StaticJsonDocument<512> doc;
  doc["status"] = status;
  doc["mode"] = "servo";
  doc["gesture"] = currentGesture;
  doc["movement"] = currentMovement;
  doc["action"] = currentAction;
  doc["commands"] = commandsReceived;
  doc["uptime"] = millis();
  doc["wifi"] = WiFi.status() == WL_CONNECTED ? "connected" : "disconnected";
  doc["ip"] = WiFi.status() == WL_CONNECTED ? WiFi.localIP().toString() : "none";
  doc["mqtt"] = mqttClient.connected() ? "connected" : "disconnected";
  addPosition(doc);
  if (msg != nullptr) doc["msg"] = msg;

  String out;
  serializeJson(doc, out);
  Serial.println(out);
  publishText(TOPIC_ARM_STATUS, out);
  publishText(TOPIC_ESP32_STATUS, out);
}

void publishActivity(const char* result, const String& msg) {
  StaticJsonDocument<512> doc;
  doc["source"] = "esp32";
  doc["mode"] = "servo";
  doc["result"] = result;
  doc["gesture"] = currentGesture;
  doc["movement"] = currentMovement;
  doc["msg"] = msg;
  doc["commands"] = commandsReceived;
  doc["uptime"] = millis();
  doc["ip"] = WiFi.status() == WL_CONNECTED ? WiFi.localIP().toString() : "none";

  String out;
  serializeJson(doc, out);
  Serial.print("MQTT => ");
  Serial.print(TOPIC_ARM_ACTIVITY);
  Serial.print(" ");
  Serial.println(out);
  publishText(TOPIC_ARM_ACTIVITY, out);
}

void publishStepActivity(int index, int total) {
  String msg = "step " + String(index) + " completed";
  StaticJsonDocument<512> doc;
  doc["source"] = "esp32";
  doc["mode"] = "servo";
  doc["result"] = "step_completed";
  doc["gesture"] = currentGesture;
  doc["movement"] = currentMovement;
  doc["step"] = index;
  doc["totalSteps"] = total;
  doc["msg"] = msg;
  doc["uptime"] = millis();

  String out;
  serializeJson(doc, out);
  Serial.print("MQTT => ");
  Serial.print(TOPIC_ARM_ACTIVITY);
  Serial.print(" ");
  Serial.println(out);
  publishText(TOPIC_ARM_ACTIVITY, out);
}

void sendError(const String& msg) {
  StaticJsonDocument<256> doc;
  doc["status"] = "error";
  doc["mode"] = "servo";
  doc["msg"] = msg;
  doc["uptime"] = millis();

  String out;
  serializeJson(doc, out);
  Serial.println(out);
  publishText(TOPIC_ESP32_STATUS, out);
  publishText(TOPIC_ESP32_LOG, out);
  blinkLed(4, 40, 40);
}

void applyStep(JsonObjectConst source) {
  if (source["base"].is<int>()) moveBaseStepper(source["base"].as<int>());

  if (source["shoulder"].is<int>()) {
    moveShoulderPair(source["shoulder"].as<int>());
  }
  if (source["elbow"].is<int>()) {
    currentPos.elbow = clampInt(source["elbow"].as<int>(), 0, 180);
    moveServo(SERVO_ELBOW, currentPos.elbow);
  }
  if (source["forearm"].is<int>()) {
    currentPos.forearm = clampInt(source["forearm"].as<int>(), 0, 180);
    moveServo(SERVO_FOREARM, currentPos.forearm);
  }
  if (source["wrist"].is<int>()) {
    currentPos.wrist = clampInt(source["wrist"].as<int>(), 0, 180);
    moveServo(SERVO_WRIST, currentPos.wrist);
  }
  if (source["gripper"].is<int>()) {
    currentPos.gripper = clampInt(source["gripper"].as<int>(), 0, 90);
    moveServo(SERVO_GRIPPER, currentPos.gripper);
  }
}

bool hasJointField(JsonDocument& doc) {

  return doc["base"].is<int>() || doc["shoulder"].is<int>() || doc["elbow"].is<int>() ||
         doc["forearm"].is<int>() || doc["wrist"].is<int>() || doc["gripper"].is<int>();
}

bool isStopCommand(JsonDocument& doc) {
  if (doc["cmd"].is<const char*>()) {
    String cmd = doc["cmd"].as<String>();
    cmd.toLowerCase();
    if (cmd == "stop") return true;
  }

  if (doc["stop"].is<bool>()) return doc["stop"].as<bool>();
  if (doc["stop"].is<int>()) return doc["stop"].as<int>() != 0;
  if (doc["stop"].is<const char*>()) {
    String value = doc["stop"].as<String>();
    value.toLowerCase();
    return value == "true" || value == "1" || value == "stop";
  }

  return false;
}

int readDelayMs(JsonObjectConst step) {
  if (step["delay"].is<int>()) return max(0, step["delay"].as<int>());
  if (step["delayMs"].is<int>()) return max(0, step["delayMs"].as<int>());
  return 300;
}

void printStepDetails(int index, int total, int delayMs) {
  Serial.print("Step ");
  Serial.print(index);
  Serial.print("/");
  Serial.print(total);
  Serial.print(" -> base=");
  Serial.print(currentPos.base);
  Serial.print(", shoulder=");
  Serial.print(currentPos.shoulder);
  Serial.print(", elbow=");
  Serial.print(currentPos.elbow);
  Serial.print(", forearm=");
  Serial.print(currentPos.forearm);
  Serial.print(", wrist=");
  Serial.print(currentPos.wrist);
  Serial.print(", gripper=");
  Serial.print(currentPos.gripper);
  Serial.print(", delay=");
  Serial.print(delayMs);
  Serial.println(" ms");
}

void handlePing() {
  StaticJsonDocument<256> doc;
  doc["status"] = "pong";
  doc["mode"] = "servo";
  doc["uptime"] = millis();
  doc["commands"] = commandsReceived;
  doc["ip"] = WiFi.status() == WL_CONNECTED ? WiFi.localIP().toString() : "none";
  doc["mqtt"] = mqttClient.connected() ? "connected" : "disconnected";

  String out;
  serializeJson(doc, out);
  Serial.println(out);
  publishText(TOPIC_ESP32_STATUS, out);
  blinkLed(1);
}

void handleMove(JsonDocument& doc) {
  if (doc["gesture"].is<const char*>()) currentGesture = doc["gesture"].as<String>();
  currentAction = "moving";
  JsonObjectConst root = doc.as<JsonObjectConst>();
  applyStep(root);
  sendStatus("ok", "move complete");
  publishActivity("success", "manual move complete");
  currentAction = "idle";
  blinkLed(2);
}

void handleSequence(JsonDocument& doc) {
  JsonArray steps;
  if (doc["sequence"].is<JsonArray>()) {
    steps = doc["sequence"].as<JsonArray>();
  } else if (doc["steps"].is<JsonArray>()) {
    steps = doc["steps"].as<JsonArray>();
  } else {
    sendError("sequence missing sequence array");
    return;
  }

  if (doc["gesture"].is<const char*>()) currentGesture = doc["gesture"].as<String>();
  if (doc["movement"].is<const char*>()) currentMovement = doc["movement"].as<String>();
  else if (doc["movementName"].is<const char*>()) currentMovement = doc["movementName"].as<String>();
  else currentMovement = "Aucun";

  String source = doc["source"].is<const char*>() ? doc["source"].as<String>() : "unknown";
  String mappingId = doc["mappingId"].is<const char*>() ? doc["mappingId"].as<String>() : "none";

  currentAction = "executing";
  Serial.println();
  Serial.println("======================================");
  Serial.println("Servo sequence received on MQTT");
  Serial.println("======================================");
  Serial.print("Gesture: ");
  Serial.println(currentGesture);
  Serial.print("Movement: ");
  Serial.println(currentMovement);
  Serial.print("Source: ");
  Serial.println(source);
  Serial.print("Mapping ID: ");
  Serial.println(mappingId);
  Serial.print("Steps: ");
  Serial.println(steps.size());
  Serial.println("======================================");

  sendStatus("ok", "sequence start");
  publishActivity("started", "sequence received by ESP32");

  int stepIndex = 0;
  for (JsonObject step : steps) {
    if (stopRequested) break;
    stepIndex++;

    JsonObjectConst stepObject = step;
    int delayMs = readDelayMs(stepObject);
    applyStep(stepObject);
    if (stopRequested) break;
    printStepDetails(stepIndex, steps.size(), delayMs);
    sendStatus("ok", "sequence step");

    unsigned long start = millis();
    while (millis() - start < (unsigned long)delayMs) {
      mqttClient.loop();
      if (stopRequested) break;
      delay(10);
    }

    Serial.print("Step ");
    Serial.print(stepIndex);
    Serial.println(" complete.");
    publishStepActivity(stepIndex, steps.size());
  }

  if (stopRequested) {
    stopRequested = false;
    currentAction = "idle";
    sendStatus("ok", "sequence stopped");
    publishActivity("stopped", "sequence stopped");
  } else {
    currentAction = "idle";
    Serial.println("Sequence finished.");
    Serial.println("======================================");
    sendStatus("ok", "sequence finished");
    publishActivity("success", "sequence finished");
  }
}

void handleStop() {
  stopRequested = true;
  currentAction = "idle";
  sendStatus("ok", "stop received");
  blinkLed(3, 40, 40);
}

void processCommand(const String& raw) {
  StaticJsonDocument<JSON_BUF_SIZE> doc;
  DeserializationError err = deserializeJson(doc, raw);

  if (err) {
    sendError(String("JSON parse error: ") + err.c_str());
    return;
  }

  if (isStopCommand(doc)) {
    commandsReceived++;
    handleStop();
    return;
  }

  String cmd;
  if (doc["cmd"].is<const char*>()) {
    cmd = doc["cmd"].as<String>();
  } else if (doc["sequence"].is<JsonArray>() || doc["steps"].is<JsonArray>()) {
    cmd = "sequence";
  } else if (hasJointField(doc)) {
    cmd = "move";
  } else {
    sendError("missing cmd field");
    return;
  }

  commandsReceived++;

  if (cmd == "ping") handlePing();
  else if (cmd == "move") handleMove(doc);
  else if (cmd == "sequence") handleSequence(doc);
  else if (cmd == "stop") handleStop();
  else sendError("unknown cmd: " + cmd);
}

void mqttCallback(char* topic, byte* payload, unsigned int length) {
  String raw;
  raw.reserve(length + 1);
  for (unsigned int i = 0; i < length; i++) raw += (char)payload[i];

  Serial.print("MQTT <= ");
  Serial.print(topic);
  Serial.print(" ");
  Serial.println(raw);
  processCommand(raw);
}

void connectWifi() {
  if (WiFi.status() == WL_CONNECTED) return;

  Serial.print("Connecting to WiFi: ");
  Serial.println(WIFI_SSID);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  int tries = 0;
  while (WiFi.status() != WL_CONNECTED && tries < WIFI_RETRY_LIMIT) {
    delay(500);
    Serial.print(".");
    tries++;
  }
  Serial.println();

  if (WiFi.status() == WL_CONNECTED) {
    Serial.print("WiFi connected. IP: ");
    Serial.println(WiFi.localIP());
    blinkLed(2, 120, 120);
  } else {
    Serial.println("WiFi connection failed. Check SSID/password.");
    blinkLed(6, 40, 40);
  }
}

bool connectMqtt() {
  if (mqttClient.connected()) return true;
  if (WiFi.status() != WL_CONNECTED) return false;

  Serial.print("Connecting to MQTT: ");
  Serial.print(MQTT_BROKER);
  Serial.print(":");
  Serial.println(MQTT_PORT);

  if (mqttClient.connect(MQTT_CLIENT_ID)) {
    bool commandSub = mqttClient.subscribe(TOPIC_ARM_COMMAND);
    bool controlSub = mqttClient.subscribe(TOPIC_APP_CONTROL);
    bool esp32Sub = mqttClient.subscribe(TOPIC_ESP32_COMMAND);
    Serial.print("MQTT connected and subscribed to ");
    Serial.print(TOPIC_ARM_COMMAND);
    Serial.print(commandSub ? " OK" : " FAILED");
    Serial.print(", ");
    Serial.print(TOPIC_APP_CONTROL);
    Serial.print(controlSub ? " OK" : " FAILED");
    Serial.print(", ");
    Serial.print(TOPIC_ESP32_COMMAND);
    Serial.println(esp32Sub ? " OK" : " FAILED");
    sendStatus("ready", "ESP32 servo MQTT ready");
    blinkLed(3, 100, 100);
    return true;
  }

  Serial.print("MQTT failed, rc=");
  Serial.println(mqttClient.state());
  return false;
}

void setDefaultPositions() {
  moveBaseStepper(90);
  currentPos.shoulder = 90;
  currentPos.elbow = 90;
  currentPos.forearm = 90;
  currentPos.wrist = 90;
  currentPos.gripper = 0;
  moveShoulderPair(currentPos.shoulder);
  moveServo(SERVO_ELBOW, currentPos.elbow);
  moveServo(SERVO_FOREARM, currentPos.forearm);
  moveServo(SERVO_WRIST, currentPos.wrist);
  moveServo(SERVO_GRIPPER, currentPos.gripper);
}

void setup() {
  pinMode(LED_BUILTIN, OUTPUT);
  digitalWrite(LED_BUILTIN, LOW);

  pinMode(STEP_PIN, OUTPUT);
  pinMode(DIR_PIN, OUTPUT);
  digitalWrite(DIR_PIN, HIGH);

  Serial.begin(SERIAL_BAUD);
  while (!Serial) delay(10);
  Serial.setTimeout(50);

  blinkLed(3);
  Serial.println("{\"status\":\"booting\",\"mode\":\"servo\"}");

  pwm.begin();
  pwm.setPWMFreq(60);
  setDefaultPositions();

  mqttClient.setServer(MQTT_BROKER, MQTT_PORT);
  mqttClient.setCallback(mqttCallback);
  mqttClient.setBufferSize(JSON_BUF_SIZE);

  connectWifi();
  connectMqtt();
}

void loop() {
  if (WiFi.status() != WL_CONNECTED) {
    connectWifi();
  }

  if (!mqttClient.connected()) {
    unsigned long now = millis();
    if (now - lastMqttReconnectAttempt > MQTT_RETRY_MS) {
      lastMqttReconnectAttempt = now;
      connectMqtt();
    }
  } else {
    mqttClient.loop();
  }

  if (Serial.available()) {
    String line = Serial.readStringUntil('\n');
    line.trim();
    if (line.length() > 0) processCommand(line);
  }

  if (millis() - lastStatusMs > 5000) {
    lastStatusMs = millis();
    sendStatus("ok", "heartbeat");
  }
}


