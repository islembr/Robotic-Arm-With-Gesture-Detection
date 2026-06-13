"""
gesture_recognition.py
───────────────────────
Real-time gesture recognition using the trained MLP model.
Replaces the hand-crafted rule-based classifier with model inference.

USAGE
─────
    python gesture_recognition.py

REQUIRES
────────
    hand_landmarker.task   — MediaPipe model
    gesture_model.pkl      — trained by train_model.py
"""

from pathlib import Path
from collections import Counter, deque
import pickle
import time

import cv2
import mediapipe as mp
import numpy as np
from mediapipe.tasks.python import BaseOptions
from mediapipe.tasks.python.vision import (
    HandLandmarker,
    HandLandmarkerOptions,
    HandLandmarksConnections,
    RunningMode,
)

# ─────────────────────────────────────────────
#  Config
# ─────────────────────────────────────────────

MODEL_PATH    = Path(__file__).with_name("hand_landmarker.task")
GESTURE_MODEL = Path(__file__).with_name("gesture_model.pkl")

STABLE_FRAMES     = 6
MIN_STABLE_FRAMES = 4
MIN_CONFIDENCE    = 0.80    # ignore predictions below this probability


# ─────────────────────────────────────────────
#  Load trained model
# ─────────────────────────────────────────────

def load_gesture_model():
    if not GESTURE_MODEL.exists():
        raise FileNotFoundError(
            f"No trained model found at {GESTURE_MODEL}\n"
            "Run train_model.py first."
        )
    with open(GESTURE_MODEL, "rb") as f:
        data = pickle.load(f)

    print(f"✅  Loaded gesture model")
    print(f"    Trained : {data.get('trained_at', 'unknown')}")
    print(f"    Samples : {data.get('n_samples', '?')}")
    print(f"    Test acc: {data.get('test_acc', 0):.2%}")
    print(f"    Classes : {data.get('classes', [])}\n")

    return data["pipeline"], data["encoder"]


# ─────────────────────────────────────────────
#  Landmark normalization (must match train_model.py)
# ─────────────────────────────────────────────

def normalize_landmarks(hand_landmarks) -> np.ndarray:
    """
    Translate to wrist origin and scale by palm size.
    Must be identical to the normalization used during training.
    """
    row = np.array([[lm.x, lm.y, lm.z] for lm in hand_landmarks], dtype=np.float32)

    # 1. Translate: wrist to origin
    row -= row[0]

    # 2. Scale: palm size (wrist → middle MCP, landmark 9) = 1.0
    palm_size = np.linalg.norm(row[9])
    if palm_size > 1e-6:
        row /= palm_size

    return row.flatten()


# ─────────────────────────────────────────────
#  Inference
# ─────────────────────────────────────────────

def recognize_gesture(hand_landmarks, pipeline, encoder) -> tuple[str, float]:
    """
    Returns (gesture_label, confidence).
    Returns ("UNKNOWN", 0.0) if confidence is below MIN_CONFIDENCE.
    """
    features = normalize_landmarks(hand_landmarks).reshape(1, -1)
    proba    = pipeline.predict_proba(features)[0]
    idx      = int(np.argmax(proba))
    conf     = float(proba[idx])

    if conf < MIN_CONFIDENCE:
        return "UNKNOWN", conf

    label = encoder.inverse_transform([idx])[0]
    return label, conf


# ─────────────────────────────────────────────
#  Temporal smoothing
# ─────────────────────────────────────────────

def stable_gesture(gesture_history: deque) -> str:
    if len(gesture_history) < STABLE_FRAMES:
        return "UNKNOWN"

    gesture, count = Counter(gesture_history).most_common(1)[0]
    if gesture != "UNKNOWN" and count >= MIN_STABLE_FRAMES:
        return gesture

    return "UNKNOWN"


# ─────────────────────────────────────────────
#  Drawing
# ─────────────────────────────────────────────

def draw_landmarks(frame, hand_landmarks):
    h, w, _ = frame.shape
    for conn in HandLandmarksConnections.HAND_CONNECTIONS:
        s = hand_landmarks[conn.start]
        e = hand_landmarks[conn.end]
        cv2.line(frame,
                 (int(s.x * w), int(s.y * h)),
                 (int(e.x * w), int(e.y * h)),
                 (0, 255, 0), 2)
    for lm in hand_landmarks:
        cv2.circle(frame, (int(lm.x * w), int(lm.y * h)), 4, (0, 0, 255), -1)


def draw_hud(frame, display_gesture: str, raw_gesture: str, confidence: float):
    h, w, _ = frame.shape

    # ── stable gesture (large, top left) ─────────────────────────────────────
    color = (0, 255, 100) if display_gesture != "UNKNOWN" else (100, 100, 100)
    cv2.putText(frame, display_gesture, (20, 55),
                cv2.FONT_HERSHEY_SIMPLEX, 1.4, color, 3)

    # ── raw prediction + confidence (below) ───────────────────────────────────
    conf_text = f"{raw_gesture}  {confidence:.0%}"
    cv2.putText(frame, conf_text, (20, 85),
                cv2.FONT_HERSHEY_SIMPLEX, 0.55, (180, 180, 180), 1)

    # Confidence bar
    bar_w = int(200 * confidence)
    bar_color = (0, 200, 0) if confidence >= MIN_CONFIDENCE else (0, 100, 200)
    cv2.rectangle(frame, (20, 95), (220, 108), (50, 50, 50), -1)
    cv2.rectangle(frame, (20, 95), (20 + bar_w, 108), bar_color, -1)

    # ── ESC hint ──────────────────────────────────────────────────────────────
    cv2.putText(frame, "ESC to quit", (w - 130, h - 12),
                cv2.FONT_HERSHEY_SIMPLEX, 0.45, (80, 80, 80), 1)


# ─────────────────────────────────────────────
#  Main loop
# ─────────────────────────────────────────────

def main():
    if not MODEL_PATH.exists():
        raise FileNotFoundError(f"Missing MediaPipe model: {MODEL_PATH}")

    pipeline, encoder = load_gesture_model()

    options = HandLandmarkerOptions(
        base_options=BaseOptions(model_asset_path=str(MODEL_PATH)),
        running_mode=RunningMode.VIDEO,
        num_hands=1,
        min_hand_detection_confidence=0.7,
        min_hand_presence_confidence=0.7,
        min_tracking_confidence=0.7,
    )

    cap             = cv2.VideoCapture(0)
    gesture_history = deque(maxlen=STABLE_FRAMES)
    raw_gesture     = "UNKNOWN"
    confidence      = 0.0

    print("🎥  Starting gesture recognition. Press ESC to quit.\n")

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
                draw_landmarks(frame, hand_landmarks)

                raw_gesture, confidence = recognize_gesture(hand_landmarks, pipeline, encoder)
                gesture_history.append(raw_gesture)
            else:
                gesture_history.clear()
                raw_gesture = "UNKNOWN"
                confidence  = 0.0

            display_gesture = stable_gesture(gesture_history)

            draw_hud(frame, display_gesture, raw_gesture, confidence)
            cv2.imshow("Gesture Recognition", frame)

            if display_gesture != "UNKNOWN":
                print(f"\r  {display_gesture:<14}  conf: {confidence:.0%}   ", end="", flush=True)

            if cv2.waitKey(1) & 0xFF == 27:
                break

    cap.release()
    cv2.destroyAllWindows()
    print("\n\nDone.\n")


if __name__ == "__main__":
    main()