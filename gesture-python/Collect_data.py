"""
collect_data.py
───────────────
Gesture data collector for the robotic arm project.

HOW TO USE
──────────
1. Run:  python collect_data.py
2. The camera window opens. Your hand landmarks will be drawn live.
3. Press a number key to start recording samples for that gesture:

      Key  Gesture
      ───  ───────────
       1   OPEN_HAND
       2   FIST
       3   THUMBS_UP
       4   INDEX_ONLY
       5   VICTORY

4. Hold the gesture steady — samples are saved automatically every 5 frames
   while the key is held down (auto-burst mode).
   You will see a green label + sample counter on screen.

5. Vary your hand:
      • different distances from the camera
      • slight left/right tilt
      • different lighting (bright, dim, side-lit)
   Aim for 200-300 samples per gesture.

6. Press  S  at any time to see a summary of samples collected so far.
7. Press  D  to delete the last 10 samples (undo a bad burst).
8. Press  ESC  to save and quit.

OUTPUT
──────
  gesture_data.csv  — one row per sample: 63 landmark floats + label string
  collection_log.txt — timestamp log of every session
"""

from pathlib import Path
from collections import Counter
from datetime import datetime
import csv
import time

import cv2
import mediapipe as mp
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

MODEL_PATH   = Path(__file__).with_name("hand_landmarker.task")
OUTPUT_CSV   = Path(__file__).with_name("gesture_data.csv")
LOG_FILE     = Path(__file__).with_name("collection_log.txt")

GESTURES = {
    ord("1"): "OPEN_HAND",
    ord("2"): "FIST",
    ord("3"): "THUMBS_UP",
    ord("4"): "INDEX_ONLY",
    ord("5"): "VICTORY",
}

# Save one sample every N frames while key is held (auto-burst)
BURST_EVERY_N_FRAMES = 5

# Visual colours
COLOR_LANDMARK   = (0, 0, 255)
COLOR_CONNECTION = (0, 255, 0)
COLOR_RECORDING  = (0, 200, 0)
COLOR_IDLE       = (200, 200, 200)
COLOR_WARNING    = (0, 100, 255)


# ─────────────────────────────────────────────
#  Helpers
# ─────────────────────────────────────────────

def landmarks_to_row(hand_landmarks, label: str) -> list:
    """Flatten 21 landmarks (x, y, z each) into 63 floats + label."""
    row = []
    for lm in hand_landmarks:
        row.extend([round(lm.x, 6), round(lm.y, 6), round(lm.z, 6)])
    row.append(label)
    return row


def save_row(row: list):
    """Append one sample row to the CSV."""
    write_header = not OUTPUT_CSV.exists()
    with open(OUTPUT_CSV, "a", newline="") as f:
        writer = csv.writer(f)
        if write_header:
            header = []
            for i in range(21):
                header.extend([f"lm{i}_x", f"lm{i}_y", f"lm{i}_z"])
            header.append("label")
            writer.writerow(header)
        writer.writerow(row)


def delete_last_n(n: int = 10):
    """Remove the last n data rows from the CSV (undo bad burst)."""
    if not OUTPUT_CSV.exists():
        return 0
    lines = OUTPUT_CSV.read_text().splitlines()
    if len(lines) <= 1:          # only header or empty
        return 0
    removed = min(n, len(lines) - 1)
    OUTPUT_CSV.write_text("\n".join(lines[:-removed]) + "\n")
    return removed


def count_samples() -> Counter:
    """Return a Counter of {label: count} from the CSV."""
    counts: Counter = Counter()
    if not OUTPUT_CSV.exists():
        return counts
    with open(OUTPUT_CSV, newline="") as f:
        reader = csv.reader(f)
        next(reader, None)       # skip header
        for row in reader:
            if row:
                counts[row[-1]] += 1
    return counts


def draw_landmarks(frame, hand_landmarks):
    h, w, _ = frame.shape
    for conn in HandLandmarksConnections.HAND_CONNECTIONS:
        s = hand_landmarks[conn.start]
        e = hand_landmarks[conn.end]
        cv2.line(frame,
                 (int(s.x * w), int(s.y * h)),
                 (int(e.x * w), int(e.y * h)),
                 COLOR_CONNECTION, 2)
    for lm in hand_landmarks:
        cv2.circle(frame, (int(lm.x * w), int(lm.y * h)), 4, COLOR_LANDMARK, -1)


def draw_hud(frame, active_gesture: str | None, session_counts: Counter, total_counts: Counter, frame_counter: int):
    """Overlay recording status and sample counts onto the frame."""
    h, w, _ = frame.shape

    # ── recording indicator ──────────────────────────────────────────────────
    if active_gesture:
        label    = f"● REC  {active_gesture}"
        color    = COLOR_RECORDING
        # Blink every 15 frames
        if (frame_counter // 15) % 2 == 0:
            cv2.rectangle(frame, (0, 0), (w, 70), (0, 60, 0), -1)
    else:
        label = "Press 1-5 to record  |  SPACE=stop  |  S=summary  |  D=undo  |  ESC=quit"
        color = COLOR_IDLE

    cv2.putText(frame, label, (15, 40),
                cv2.FONT_HERSHEY_SIMPLEX, 0.75, color, 2)

    # ── per-gesture sample counters (bottom strip) ───────────────────────────
    strip_y = h - 10
    cv2.rectangle(frame, (0, h - 50), (w, h), (20, 20, 20), -1)

    col_w = w // len(GESTURES)
    for i, name in enumerate(GESTURES.values()):
        total   = total_counts[name]
        session = session_counts[name]
        bar_color = (0, 180, 0) if total >= 200 else (0, 130, 200)
        text = f"{name.replace('_', ' ')}: {total} (+{session})"
        cv2.putText(frame, text, (i * col_w + 5, strip_y),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.38, bar_color, 1)


def print_summary(total_counts: Counter):
    print("\n─────────────────────────────────────")
    print("  Gesture samples collected so far:")
    print("─────────────────────────────────────")
    for name in GESTURES.values():
        count  = total_counts[name]
        status = "✓ good" if count >= 200 else f"need {200 - count} more"
        bar    = "█" * (count // 10) + "░" * max(0, 20 - count // 10)
        print(f"  {name:<14} {bar}  {count:>3}  {status}")
    print("─────────────────────────────────────\n")


def log_session(session_counts: Counter):
    with open(LOG_FILE, "a") as f:
        f.write(f"\n[{datetime.now():%Y-%m-%d %H:%M:%S}]\n")
        for name, count in session_counts.items():
            f.write(f"  {name}: +{count}\n")


# ─────────────────────────────────────────────
#  Main
# ─────────────────────────────────────────────

def main():
    if not MODEL_PATH.exists():
        raise FileNotFoundError(
            f"Missing model: {MODEL_PATH}\n"
            "Download hand_landmarker.task and place it next to this script.\n"
            "https://storage.googleapis.com/mediapipe-models/hand_landmarker/"
            "hand_landmarker/float16/latest/hand_landmarker.task"
        )

    options = HandLandmarkerOptions(
        base_options=BaseOptions(model_asset_path=str(MODEL_PATH)),
        running_mode=RunningMode.VIDEO,
        num_hands=1,
        min_hand_detection_confidence=0.6,
        min_hand_presence_confidence=0.6,
        min_tracking_confidence=0.6,
    )

    cap             = cv2.VideoCapture(0)
    session_counts  = Counter()
    total_counts    = count_samples()
    frame_counter   = 0
    active_gesture  = None
    burst_counter   = 0

    print("\n🤖  Gesture Data Collector — Robotic Arm Project")
    print("────────────────────────────────────────────────")
    print("Keys:  1=OPEN_HAND  2=FIST  3=THUMBS_UP  4=INDEX_ONLY  5=VICTORY")
    print("       S=summary    D=undo last 10        ESC=save & quit\n")
    print_summary(total_counts)

    with HandLandmarker.create_from_options(options) as landmarker:
        while True:
            success, frame = cap.read()
            if not success:
                break

            frame         = cv2.flip(frame, 1)
            rgb           = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            mp_image      = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)
            timestamp_ms  = int(time.monotonic() * 1000)
            result        = landmarker.detect_for_video(mp_image, timestamp_ms)

            hand_detected = bool(result.hand_landmarks)

            if hand_detected:
                hand_landmarks = result.hand_landmarks[0]
                draw_landmarks(frame, hand_landmarks)

                # ── auto-burst save ──────────────────────────────────────────
                if active_gesture:
                    burst_counter += 1
                    if burst_counter >= BURST_EVERY_N_FRAMES:
                        burst_counter = 0
                        row = landmarks_to_row(hand_landmarks, active_gesture)
                        save_row(row)
                        session_counts[active_gesture] += 1
                        total_counts[active_gesture]   += 1
            else:
                # No hand — warn user if they're trying to record
                if active_gesture:
                    cv2.putText(frame, "⚠  No hand detected", (15, 80),
                                cv2.FONT_HERSHEY_SIMPLEX, 0.7, COLOR_WARNING, 2)

            draw_hud(frame, active_gesture, session_counts, total_counts, frame_counter)
            cv2.imshow("Gesture Data Collector", frame)

            # ── key handling ────────w─────────────────────────────────────────
            key = cv2.waitKey(1) & 0xFF

            if key in GESTURES:
                selected_gesture = GESTURES[key]
                if active_gesture != selected_gesture:
                    active_gesture = selected_gesture
                    burst_counter  = 0

            elif key == ord(" "):
                # Space stops the current recording burst.
                active_gesture = None
                burst_counter  = 0

            elif key == ord("s") or key == ord("S"):
                total_counts = count_samples()   # re-read from disk
                print_summary(total_counts)

            elif key == ord("d") or key == ord("D"):
                removed = delete_last_n(10)
                total_counts = count_samples()
                print(f"  Removed last {removed} samples. New totals:")
                print_summary(total_counts)

            elif key == 27:   # ESC
                break

            frame_counter += 1

    cap.release()
    cv2.destroyAllWindows()

    # ── session wrap-up ───────────────────────────────────────────────────────
    total_counts = count_samples()
    print("\n✅  Session complete. Final counts:")
    print_summary(total_counts)
    log_session(session_counts)

    all_good = all(total_counts[g] >= 200 for g in GESTURES.values())
    if all_good:
        print("🎉  All gestures have 200+ samples. Ready to train!\n")
        print("    Next step:  python train_model.py\n")
    else:
        missing = {g: 200 - total_counts[g] for g in GESTURES.values() if total_counts[g] < 200}
        print("⚠   Still need more samples for:")
        for g, n in missing.items():
            print(f"      {g}: {n} more needed")
        print()


if __name__ == "__main__":
    main()
