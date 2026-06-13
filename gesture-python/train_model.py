"""
train_model.py
──────────────
Trains an MLP classifier on the collected gesture landmark data.

WHAT IT DOES
────────────
1. Loads gesture_data.csv
2. Normalizes landmarks relative to the wrist (translation + scale invariant)
3. Splits into train / validation / test sets
4. Trains an MLP neural network
5. Prints a full classification report + confusion matrix
6. Saves the model to gesture_model.pkl

USAGE
─────
    python train_model.py

OUTPUT FILES
────────────
    gesture_model.pkl   — trained model + label encoder (used by the main app)
    training_report.txt — full metrics saved to disk for reference
"""

from pathlib import Path
from datetime import datetime
import pickle
import csv
import sys

import numpy as np
from sklearn.neural_network import MLPClassifier
from sklearn.model_selection import train_test_split, StratifiedKFold, cross_val_score
from sklearn.preprocessing import LabelEncoder, StandardScaler
from sklearn.metrics import classification_report, confusion_matrix
from sklearn.pipeline import Pipeline

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

# ─────────────────────────────────────────────
#  Config
# ─────────────────────────────────────────────

DATA_PATH   = Path(__file__).with_name("gesture_data.csv")
MODEL_PATH  = Path(__file__).with_name("gesture_model.pkl")
REPORT_PATH = Path(__file__).with_name("training_report.txt")

# MLP architecture — tuned for 63-feature landmark input
HIDDEN_LAYERS  = (256, 128, 64)
MAX_ITER       = 1000
RANDOM_STATE   = 42


# ─────────────────────────────────────────────
#  Landmark normalization
# ─────────────────────────────────────────────

def normalize_landmarks(raw: np.ndarray) -> np.ndarray:
    """
    Make landmarks invariant to hand position and size in the frame.

    Steps:
      1. Translate so wrist (landmark 0) is at origin
      2. Scale so the palm size (wrist → middle MCP, landmark 9) = 1.0

    This means the model learns hand *shape*, not where the hand is on screen.
    Input shape:  (N, 63)   — N samples, 21 landmarks × (x, y, z)
    Output shape: (N, 63)
    """
    normalized = raw.copy().astype(np.float32)

    for i in range(len(normalized)):
        row = normalized[i].reshape(21, 3)

        # 1. Translate: subtract wrist position (landmark 0)
        wrist = row[0].copy()
        row  -= wrist

        # 2. Scale: divide by distance from wrist to middle-finger MCP (landmark 9)
        palm_size = np.linalg.norm(row[9])
        if palm_size > 1e-6:
            row /= palm_size

        normalized[i] = row.flatten()

    return normalized


# ─────────────────────────────────────────────
#  Data loading
# ─────────────────────────────────────────────

def load_data():
    if not DATA_PATH.exists():
        raise FileNotFoundError(
            f"No data file found at {DATA_PATH}\n"
            "Run collect_data.py first."
        )

    X, y = [], []
    with open(DATA_PATH, newline="") as f:
        reader = csv.reader(f)
        header = next(reader, None)   # skip header row

        for row in reader:
            if len(row) != 64:        # 63 features + 1 label
                continue
            try:
                features = [float(v) for v in row[:63]]
                label    = row[63].strip()
                X.append(features)
                y.append(label)
            except ValueError:
                continue              # skip malformed rows

    X = np.array(X, dtype=np.float32)
    y = np.array(y)

    print(f"  Loaded {len(X)} samples across {len(set(y))} gestures")
    for label in sorted(set(y)):
        print(f"    {label:<14} {(y == label).sum():>4} samples")

    return X, y


# ─────────────────────────────────────────────
#  Confusion matrix printer
# ─────────────────────────────────────────────

def print_confusion_matrix(cm, labels):
    col_w = 13
    print("\n  Confusion matrix (rows=actual, cols=predicted):\n")
    header = " " * 16 + "".join(f"{l[:10]:>{col_w}}" for l in labels)
    print(header)
    print("  " + "─" * (14 + col_w * len(labels)))
    for i, row_label in enumerate(labels):
        row_str = f"  {row_label:<14}"
        for j, val in enumerate(cm[i]):
            cell = str(val)
            color = "✓" if i == j and val > 0 else (" " if val == 0 else "✗")
            row_str += f"{cell + color:>{col_w}}"
        print(row_str)
    print()


# ─────────────────────────────────────────────
#  Training
# ─────────────────────────────────────────────

def train():
    print("\n🤖  Gesture Model Trainer — Robotic Arm Project")
    print("─────────────────────────────────────────────────\n")

    # ── 1. Load ──────────────────────────────────────────────────────────────
    print("📂  Loading data...")
    X_raw, y_raw = load_data()

    # ── 2. Normalize ─────────────────────────────────────────────────────────
    print("\n⚙️   Normalizing landmarks (wrist-relative, scale-invariant)...")
    X = normalize_landmarks(X_raw)

    # ── 3. Encode labels ─────────────────────────────────────────────────────
    le = LabelEncoder()
    y  = le.fit_transform(y_raw)
    print(f"  Classes: {list(le.classes_)}")

    # ── 4. Split: 70% train / 15% val / 15% test ─────────────────────────────
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.15, random_state=RANDOM_STATE, stratify=y
    )
    X_train, X_val, y_train, y_val = train_test_split(
        X_train, y_train, test_size=0.15 / 0.85,
        random_state=RANDOM_STATE, stratify=y_train
    )

    print(f"\n  Split → train: {len(X_train)}  val: {len(X_val)}  test: {len(X_test)}")

    # ── 5. Build pipeline (scaler + MLP) ─────────────────────────────────────
    print(f"\n🧠  Training MLP {HIDDEN_LAYERS}...")
    pipeline = Pipeline([
        ("scaler", StandardScaler()),
        ("mlp", MLPClassifier(
            hidden_layer_sizes = HIDDEN_LAYERS,
            activation         = "relu",
            solver             = "adam",
            alpha              = 1e-4,        # L2 regularization
            batch_size         = 32,
            learning_rate_init = 1e-3,
            max_iter           = MAX_ITER,
            early_stopping     = True,
            validation_fraction= 0.1,
            n_iter_no_change   = 20,
            random_state       = RANDOM_STATE,
            verbose            = False,
        ))
    ])

    pipeline.fit(X_train, y_train)
    n_iter = pipeline.named_steps["mlp"].n_iter_
    print(f"  Converged in {n_iter} iterations")

    # ── 6. Evaluate ───────────────────────────────────────────────────────────
    val_acc  = pipeline.score(X_val,  y_val)
    test_acc = pipeline.score(X_test, y_test)

    print(f"\n📊  Validation accuracy : {val_acc:.2%}")
    print(f"    Test accuracy       : {test_acc:.2%}")

    # Cross-validation on full dataset for a robust estimate
    print("\n  Running 5-fold cross-validation on full dataset...")
    cv_scores = cross_val_score(pipeline, X, y, cv=StratifiedKFold(5), scoring="accuracy")
    print(f"  CV accuracy: {cv_scores.mean():.2%} ± {cv_scores.std():.2%}")

    # Per-class report
    y_pred   = pipeline.predict(X_test)
    labels   = le.classes_
    report   = classification_report(y_test, y_pred, target_names=labels)
    cm       = confusion_matrix(y_test, y_pred)

    print("\n  Per-gesture metrics (on held-out test set):\n")
    print(report)
    print_confusion_matrix(cm, labels)

    # ── 7. Warn on weak gestures ──────────────────────────────────────────────
    report_dict = classification_report(
        y_test, y_pred, target_names=labels, output_dict=True
    )
    weak = [g for g in labels if report_dict[g]["f1-score"] < 0.95]
    if weak:
        print(f"⚠️   Low F1 (<0.95) on: {weak}")
        print("    Consider collecting 50–100 more samples for these gestures")
        print("    and re-running this script.\n")
    else:
        print("✅  All gestures scoring F1 ≥ 0.95 — model looks solid.\n")

    # ── 8. Save model ─────────────────────────────────────────────────────────
    model_data = {
        "pipeline"  : pipeline,    # scaler + MLP
        "encoder"   : le,          # label encoder
        "classes"   : list(labels),
        "trained_at": datetime.now().isoformat(),
        "n_samples" : len(X),
        "test_acc"  : test_acc,
        "cv_mean"   : float(cv_scores.mean()),
        "cv_std"    : float(cv_scores.std()),
    }

    with open(MODEL_PATH, "wb") as f:
        pickle.dump(model_data, f)

    print(f"💾  Model saved → {MODEL_PATH}")

    # ── 9. Save human-readable report ─────────────────────────────────────────
    with open(REPORT_PATH, "w") as f:
        f.write(f"Gesture Model Training Report\n")
        f.write(f"Trained: {datetime.now():%Y-%m-%d %H:%M:%S}\n")
        f.write(f"Samples: {len(X)}\n")
        f.write(f"Test accuracy:  {test_acc:.2%}\n")
        f.write(f"CV accuracy:    {cv_scores.mean():.2%} ± {cv_scores.std():.2%}\n\n")
        f.write(report)

    print(f"📄  Report saved → {REPORT_PATH}")
    print("\n─────────────────────────────────────────────────")
    print("  Next step:  python gesture_recognition.py")
    print("─────────────────────────────────────────────────\n")


# ─────────────────────────────────────────────
#  Entry point
# ─────────────────────────────────────────────

if __name__ == "__main__":
    train()
