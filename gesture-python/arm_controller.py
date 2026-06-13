"""Arm controller adapter used by mqtt_bridge.py.

Works in two modes:
- simulator mode when no serial port is provided
- serial test mode with the ESP32 connection-test firmware

Serial payload format is JSON per line.
"""

import json
import time

try:
    import serial
except ImportError:  # pragma: no cover - handled at runtime
    serial = None


HOME_POSITION = {
    "base": 90,
    "shoulder": 90,
    "elbow": 90,
    "forearm": 90,
    "wrist": 90,
    "gripper": 0,
}

JOINT_LIMITS = {
    "base": (0, 180),
    "shoulder": (0, 180),
    "elbow": (0, 180),
    "forearm": (0, 180),
    "wrist": (0, 180),
    "gripper": (0, 90),
}

ACK_MESSAGES = {
    "ping": {"pong"},
    "move": {"move received", "move complete in test mode"},
    "sequence": {"sequence start", "sequence step", "sequence complete in test mode", "sequence stopped"},
    "stop": {"stop received"},
}


class ArmController:
    def __init__(self, port=None, baudrate=115200, timeout=1):
        self.port = port
        self.baudrate = baudrate
        self.timeout = timeout
        self.serial = None
        self.simulated = True
        self.last_status = {
            "connected": False,
            "mode": "simulator",
            "action": "idle",
            "pos": dict(HOME_POSITION),
        }

    def connect(self):
        if not self.port:
            print("ArmController: no serial port provided; using simulator mode.")
            self.last_status.update({"connected": True, "mode": "simulator"})
            return True

        if serial is None:
            print("ArmController: pyserial is not installed; using simulator mode.")
            self.last_status.update({"connected": True, "mode": "simulator"})
            return True

        try:
            self.serial = serial.Serial(self.port, self.baudrate, timeout=self.timeout)
            time.sleep(2)
            self.serial.reset_input_buffer()
            self.serial.reset_output_buffer()
            self.simulated = False
            self.last_status.update({"connected": True, "mode": "serial-test"})
            print(f"ArmController: connected to ESP32 on {self.port}.")
            self.ping()
            return True
        except Exception as exc:
            print(f"ArmController: could not open {self.port}: {exc}")
            print("ArmController: falling back to simulator mode.")
            self.last_status.update({"connected": True, "mode": "simulator"})
            return True

    def disconnect(self):
        if self.serial and self.serial.is_open:
            self.serial.close()
        self.last_status["connected"] = False

    def ping(self):
        return self._send({"cmd": "ping"})

    def move(self, base=None, shoulder=None, elbow=None, forearm=None, wrist=None, gripper=None):
        updates = {
            "base": base,
            "shoulder": shoulder,
            "elbow": elbow,
            "forearm": forearm,
            "wrist": wrist,
            "gripper": gripper,
        }
        position = dict(self.last_status.get("pos", HOME_POSITION))

        for joint, value in updates.items():
            if value is None:
                continue
            position[joint] = self._clamp(joint, value)

        self.last_status["pos"] = position
        payload = {"cmd": "move", **position}
        self._send(payload, read_window=0.8)
        return position

    def play_sequence(self, gesture, sequences):
        steps = sequences.get(gesture, []) if isinstance(sequences, dict) else sequences
        normalized_steps = []

        for step in steps:
            normalized_steps.append({
                "base": self._clamp("base", step.get("base", self.last_status["pos"].get("base", 90))),
                "shoulder": self._clamp("shoulder", step.get("shoulder", self.last_status["pos"].get("shoulder", 90))),
                "elbow": self._clamp("elbow", step.get("elbow", self.last_status["pos"].get("elbow", 90))),
                "forearm": self._clamp("forearm", step.get("forearm", self.last_status["pos"].get("forearm", 90))),
                "wrist": self._clamp("wrist", step.get("wrist", self.last_status["pos"].get("wrist", 90))),
                "gripper": self._clamp("gripper", step.get("gripper", self.last_status["pos"].get("gripper", 0))),
                "delay": max(0, int(step.get("delay", step.get("delayMs", 500)))),
            })

        if self.simulated or not self.serial:
            for step in normalized_steps:
                self.last_status["pos"] = {key: step[key] for key in HOME_POSITION}
                print(f"ArmController simulator step: {step}")
                time.sleep(step["delay"] / 1000)
        else:
            total_delay = sum(step["delay"] for step in normalized_steps) / 1000
            self._send(
                {"cmd": "sequence", "gesture": gesture, "steps": normalized_steps},
                read_window=max(2.0, total_delay + 1.0),
            )

        return {"gesture": gesture, "steps": len(normalized_steps), "pos": self.last_status.get("pos", {})}

    def _send(self, payload, read_window=0.8):
        if self.simulated or not self.serial:
            print(f"ArmController simulator: {payload}")
            return None

        cmd = payload.get("cmd", "")
        line = json.dumps(payload) + "\n"
        self.serial.write(line.encode("utf-8"))
        self.serial.flush()
        print(f"ESP32 <= {line.strip()}")
        return self._read_responses(cmd=cmd, read_window=read_window)

    def _read_responses(self, cmd="", read_window=0.8):
        deadline = time.time() + read_window
        command_response = None
        expected_messages = ACK_MESSAGES.get(cmd, set())

        while time.time() < deadline:
            raw = self.serial.readline().decode("utf-8", errors="replace").strip()
            if not raw:
                continue

            try:
                data = json.loads(raw)
            except json.JSONDecodeError:
                print(f"ESP32 => {raw}")
                continue

            self._update_status_from_esp32(data)

            msg = data.get("msg")
            status = data.get("status")
            is_heartbeat = msg == "heartbeat"
            is_expected_ack = status in expected_messages or msg in expected_messages
            is_error = status == "error"

            if is_heartbeat:
                print(f"ESP32 heartbeat: uptime={data.get('uptime')} commands={data.get('commands')}")
                continue

            print(f"ESP32 => {json.dumps(data, separators=(',', ':'))}")

            if is_error or is_expected_ack or not expected_messages:
                command_response = data
                if cmd in {"ping", "stop"} or is_error:
                    break
                if cmd == "move" and msg == "move complete in test mode":
                    break
                if cmd == "sequence" and msg in {"sequence complete in test mode", "sequence stopped"}:
                    break

        if command_response is None and expected_messages:
            print(f"ESP32 ack timeout for cmd={cmd}; ignored heartbeat-only responses")

        return command_response

    def _update_status_from_esp32(self, data):
        if not isinstance(data, dict):
            return
        if "pos" in data and isinstance(data["pos"], dict):
            self.last_status["pos"] = {**self.last_status.get("pos", HOME_POSITION), **data["pos"]}
        if "action" in data:
            self.last_status["action"] = data["action"]
        if "mode" in data:
            self.last_status["mode"] = data["mode"]
        self.last_status["last_esp32"] = data

    def _clamp(self, joint, value):
        low, high = JOINT_LIMITS[joint]
        return max(low, min(high, int(round(value))))
