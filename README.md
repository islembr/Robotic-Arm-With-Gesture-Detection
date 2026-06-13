# Robotic Arm With Gesture Detection

University PFA project for a gesture-controlled robotic arm.

## Structure

- `mobile-app/`: React Native Expo app used by the patient.
- `aidant-dashboard/`: Next.js Aidant dashboard and NestJS backend.
- `gesture-python/`: Python gesture detection and MQTT publishing.
- `esp32-firmware/`: ESP32 firmware for the robotic arm.

## Main Flow

```text
Mobile App -> HTTP -> NestJS Backend -> MongoDB
Mobile App -> MQTT -> ESP32
Python Gesture Detection -> MQTT -> NestJS Backend -> MQTT -> ESP32
ESP32 -> MQTT -> Mobile App + Backend + Aidant Dashboard
Aidant Dashboard -> HTTP -> NestJS Backend
```

## Important Notes

- Configure IP addresses in the app/backend/Python/ESP32 files before running on a new network.
- Do not commit real `.env` files or Wi-Fi credentials.
- The Aidant dashboard supervises the system; it does not directly control the robotic arm.
