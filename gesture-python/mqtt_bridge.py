"""
mqtt_bridge.py
â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
Runs on the PC. Connects:
  - Camera + ML gesture model  (gesture_recognition.py logic)
  - MQTT broker                (speaks to mobile app)
  - ESP32 via USB Serial       (arm_controller.py)

Subscribes to:
  arm/control        â† slider moves from app â†’ forward to ESP32
  arm/sequence/save  â† new sequence saved in app â†’ store locally

Publishes to:
  arm/gesture        â†’ detected gesture + confidence â†’ app
  arm/status         â†’ arm position + action â†’ app
  arm/log            â†’ action history â†’ app

USAGE
â”€â”€â”€â”€â”€
    python mqtt_bridge.py
    python mqtt_bridge.py --port COM3        # specify serial port
    python mqtt_bridge.py --port /dev/ttyUSB0
"""

import argparse
import sys
import json
import time
import threading
from datetime import datetime, timezone
from pathlib import Path
from collections import deque, Counter
import pickle

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
if hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')

import paho.mqtt.client as mqtt_client
import cv2
import mediapipe as mp
import numpy as np
from mediapipe.tasks.python import BaseOptions
from mediapipe.tasks.python.vision import (
    HandLandmarker,
    HandLandmarkerOptions,
    RunningMode,
)

from arm_controller import ArmController

# â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
#  Config
# â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

MQTT_BROKER     = "172.20.10.4"
MQTT_PORT       = 1883
MQTT_CLIENT_ID  = "pc_bridge"
GESTURE_TOPIC   = "arm/gesture"
GESTURE_PREVIEW_TOPIC = "arm/gesture/preview"

MEDIAPIPE_MODEL = Path(__file__).with_name("hand_landmarker.task")
GESTURE_MODEL   = Path(__file__).with_name("gesture_model.pkl")
SEQUENCES_FILE  = Path(__file__).with_name("sequences.json")

DETECT_ONLY_MODE = True
CONFIDENCE_THRESHOLD = 0.85
STABLE_FRAMES_REQUIRED = 8
COOLDOWN_SECONDS = 2.0
PREVIEW_INTERVAL_SECONDS = 0.35

STABLE_FRAMES     = STABLE_FRAMES_REQUIRED
MIN_STABLE_FRAMES = STABLE_FRAMES_REQUIRED
MIN_CONFIDENCE    = CONFIDENCE_THRESHOLD

# How often to publish arm status to MQTT (seconds)
STATUS_INTERVAL = 1.0


# â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
#  Gesture model
# â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

def load_gesture_model():
    with open(GESTURE_MODEL, "rb") as f:
        data = pickle.load(f)
    return data["pipeline"], data["encoder"]


def normalize_landmarks(hand_landmarks) -> np.ndarray:
    row = np.array([[lm.x, lm.y, lm.z] for lm in hand_landmarks], dtype=np.float32)
    row -= row[0]
    palm_size = np.linalg.norm(row[9])
    if palm_size > 1e-6:
        row /= palm_size
    return row.flatten()


def recognize_gesture(hand_landmarks, pipeline, encoder) -> tuple[str, float]:
    features = normalize_landmarks(hand_landmarks).reshape(1, -1)
    proba    = pipeline.predict_proba(features)[0]
    idx      = int(np.argmax(proba))
    conf     = float(proba[idx])
    if conf < CONFIDENCE_THRESHOLD:
        return "NONE", conf
    return encoder.inverse_transform([idx])[0], conf


def stable_gesture(history: deque) -> str:
    if len(history) < STABLE_FRAMES_REQUIRED:
        return "NONE"
    gesture, count = Counter(history).most_common(1)[0]
    if gesture != "NONE" and count >= STABLE_FRAMES_REQUIRED:
        return gesture
    return "NONE"


# â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
#  Sequence store
# â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

def load_sequences() -> dict:
    if SEQUENCES_FILE.exists():
        return json.loads(SEQUENCES_FILE.read_text())
    return {}


def save_sequences(sequences: dict):
    SEQUENCES_FILE.write_text(json.dumps(sequences, indent=2))


# â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
#  Bridge
# â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

class ArmBridge:
    def __init__(self, serial_port: str = None):
        self.arm        = None if DETECT_ONLY_MODE else ArmController(port=serial_port)
        self.sequences  = {} if DETECT_ONLY_MODE else load_sequences()
        self.pipeline   = None
        self.encoder    = None
        self.mqtt       = None

        self.last_stable    = "NONE"
        self.candidate_gesture = "NONE"
        self.candidate_count = 0
        self.locked_gesture = None
        self.last_publish_time = 0.0
        self.last_preview_gesture = None
        self.last_preview_time = 0.0
        self.gesture_history = deque(maxlen=STABLE_FRAMES)
        self.sequence_lock  = threading.Lock()
        self.executing      = False

    # â”€â”€ MQTT setup â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    def setup_mqtt(self):
        self.mqtt = mqtt_client.Client(mqtt_client.CallbackAPIVersion.VERSION1, client_id=MQTT_CLIENT_ID)
        self.mqtt.on_connect    = self._on_connect
        self.mqtt.on_message    = self._on_message
        self.mqtt.on_disconnect = self._on_disconnect
        self.mqtt.connect(MQTT_BROKER, MQTT_PORT, keepalive=60)
        self.mqtt.loop_start()

    def _on_connect(self, client, userdata, flags, rc):
        if rc == 0:
            print(f"âœ…  MQTT connected to {MQTT_BROKER}")
            if not DETECT_ONLY_MODE:
                client.subscribe("arm/control")
                client.subscribe("arm/sequence/save")
        else:
            print(f"âŒ  MQTT connection failed: rc={rc}")

    def _on_disconnect(self, client, userdata, rc):
        print("âš ï¸   MQTT disconnected â€” reconnecting...")

    def _on_message(self, client, userdata, msg):
        if DETECT_ONLY_MODE:
            return

        try:
            payload = json.loads(msg.payload.decode())
        except json.JSONDecodeError:
            return

        topic = msg.topic

        # Live slider control from app â†’ forward to ESP32
        if topic == "arm/control":
            if not self.executing:
                self.arm.move(
                    base     = payload.get("base"),
                    shoulder = payload.get("shoulder"),
                    elbow    = payload.get("elbow"),
                    wrist    = payload.get("wrist"),
                    gripper  = payload.get("gripper"),
                )

        # New sequence saved from app â†’ store it
        elif topic == "arm/sequence/save":
            gesture = payload.get("gesture")
            steps   = payload.get("steps", [])
            if gesture and steps:
                with self.sequence_lock:
                    self.sequences[gesture] = steps
                    save_sequences(self.sequences)
                print(f"  ðŸ’¾ Sequence saved: {gesture} ({len(steps)} steps)")

    # â”€â”€ Publishing â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    def publish_gesture(self, gesture: str, confidence: float):
        self.mqtt.publish(GESTURE_TOPIC, json.dumps({
            "gesture":    gesture,
            "confidence": round(confidence, 3),
            "timestamp":  datetime.now(timezone.utc).isoformat(),
        }))
        print(f"Published gesture: {gesture}")

    def publish_gesture_preview(self, gesture: str, confidence: float):
        """Publish camera preview updates for mobile confirmation without triggering execution."""
        now = time.monotonic()
        if (
            gesture == self.last_preview_gesture
            and now - self.last_preview_time < PREVIEW_INTERVAL_SECONDS
        ):
            return

        self.last_preview_gesture = gesture
        self.last_preview_time = now
        self.mqtt.publish(GESTURE_PREVIEW_TOPIC, json.dumps({
            "gesture": gesture,
            "confidence": round(confidence, 3),
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }))

    def publish_status(self, action: str = "idle"):
        if DETECT_ONLY_MODE or self.arm is None:
            return

        status = self.arm.last_status
        self.mqtt.publish("arm/status", json.dumps({
            "gesture": self.last_stable,
            "action":  action,
            "pos":     status.get("pos", {}),
            "timestamp": time.time(),
        }))

    def publish_log(self, gesture: str, action: str):
        if DETECT_ONLY_MODE:
            return

        self.mqtt.publish("arm/log", json.dumps({
            "gesture":   gesture,
            "action":    action,
            "timestamp": time.time(),
        }))

    # â”€â”€ Gesture â†’ action â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    def unlock_gesture(self, reason: str):
        if self.locked_gesture is not None:
            print(f"Gesture unlocked: {reason}")
        self.locked_gesture = None

    def process_detected_gesture(self, gesture: str, confidence: float) -> str:
        """Stabilize detections and publish one MQTT event per intentional gesture."""
        if gesture in ("NONE", "UNKNOWN"):
            self.candidate_gesture = "NONE"
            self.candidate_count = 0
            self.last_stable = "NONE"
            self.unlock_gesture("gesture cleared")
            return "NONE"

        if confidence < CONFIDENCE_THRESHOLD:
            self.candidate_gesture = "NONE"
            self.candidate_count = 0
            self.last_stable = "NONE"
            self.unlock_gesture("confidence below threshold")
            return "NONE"

        if gesture != self.candidate_gesture:
            self.candidate_gesture = gesture
            self.candidate_count = 1
            print(f"Gesture candidate: {gesture}")
            return "NONE"

        self.candidate_count += 1
        if self.candidate_count < STABLE_FRAMES_REQUIRED:
            return "NONE"

        stable = gesture
        if stable != self.last_stable:
            self.last_stable = stable
            print(f"Gesture stable: {stable}")

        if self.locked_gesture == stable:
            return stable

        if self.locked_gesture is not None and self.locked_gesture != stable:
            self.unlock_gesture("different stable gesture")

        now = time.monotonic()
        if now - self.last_publish_time < COOLDOWN_SECONDS:
            return stable

        print(f"  ðŸ‘‹ {stable}  ({confidence:.0%})")
        self.publish_gesture(stable, confidence)
        self.locked_gesture = stable
        self.last_publish_time = now
        print("Gesture locked")

        return stable

    def _execute_sequence(self, gesture: str, steps: list):
        self.executing = True
        self.publish_log(gesture, "executing")
        self.publish_status("executing")

        result = self.arm.play_sequence(gesture, {gesture: steps})

        self.executing = False
        self.publish_log(gesture, "done")
        self.publish_status("idle")

    # â”€â”€ Main camera loop â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    def run(self):
        print("\nðŸ¤–  Arm Bridge starting...\n")

        if DETECT_ONLY_MODE:
            print("Detect-only mode enabled: Python will only publish stable gestures to arm/gesture.")
        else:
            # Connect ESP32
            if self.arm is None or not self.arm.connect():
                print("âŒ  Could not connect to ESP32. Check USB connection.")
                return

        # Load gesture model
        print("ðŸ§   Loading gesture model...")
        self.pipeline, self.encoder = load_gesture_model()

        # Connect MQTT
        print("ðŸ“¡  Connecting to MQTT broker...")
        self.setup_mqtt()
        time.sleep(1)   # wait for MQTT to connect

        # Start camera
        options = HandLandmarkerOptions(
            base_options=BaseOptions(model_asset_path=str(MEDIAPIPE_MODEL)),
            running_mode=RunningMode.VIDEO,
            num_hands=1,
            min_hand_detection_confidence=0.7,
            min_hand_presence_confidence=0.7,
            min_tracking_confidence=0.7,
        )

        cap              = cv2.VideoCapture(0)
        raw_gesture      = "NONE"
        confidence       = 0.0

        print("\nâœ…  Bridge running. Press ESC in camera window to quit.\n")

        with HandLandmarker.create_from_options(options) as landmarker:
            while True:
                success, frame = cap.read()
                if not success:
                    break

                frame        = cv2.flip(frame, 1)
                rgb          = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                mp_image     = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)
                timestamp_ms = int(time.monotonic() * 1000)
                result       = landmarker.detect_for_video(mp_image, timestamp_ms)

                if result.hand_landmarks:
                    hand_landmarks = result.hand_landmarks[0]
                    raw_gesture, confidence = recognize_gesture(
                        hand_landmarks, self.pipeline, self.encoder
                    )
                    self.gesture_history.append(raw_gesture)
                else:
                    self.gesture_history.clear()
                    raw_gesture = "NONE"
                    confidence  = 0.0

                self.publish_gesture_preview(raw_gesture, confidence)
                stable = self.process_detected_gesture(raw_gesture, confidence)

                # Camera preview with overlay
                color = (0, 255, 100) if stable != "NONE" else (100, 100, 100)
                cv2.putText(frame, stable, (20, 50),
                            cv2.FONT_HERSHEY_SIMPLEX, 1.2, color, 3)
                cv2.putText(frame, f"{raw_gesture} {confidence:.0%}", (20, 80),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.55, (180, 180, 180), 1)
                cv2.imshow("Arm Bridge", frame)

                if cv2.waitKey(1) & 0xFF == 27:
                    break

        cap.release()
        cv2.destroyAllWindows()
        self.mqtt.loop_stop()
        if self.arm is not None:
            self.arm.disconnect()
        print("\nBridge stopped.\n")


# â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
#  Entry point
# â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Arm MQTT Bridge")
    parser.add_argument("--port", help="ESP32 serial port (e.g. COM3 or /dev/ttyUSB0)")
    args = parser.parse_args()

    bridge = ArmBridge(serial_port=args.port)
    bridge.run()

