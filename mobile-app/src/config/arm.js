export const MQTT_CONFIG = {
  brokerUrl: 'ws://172.20.10.4:1884',
  topics: {
    control: 'arm/control',
    sequenceSave: 'arm/sequence/save',
    status: 'arm/status',
    gesture: 'arm/gesture',
    gesturePreview: 'arm/gesture/preview',
    activity: 'arm/activity',
    log: 'arm/log',
  },
};

export const API_CONFIG = {
  baseUrl: 'http://172.20.10.4:4000',
};

export const HOME_POSITION = {
  base: 90,
  shoulder: 90,
  elbow: 90,
  forearm: 90,
  wrist: 90,
  gripper: 0,
};

export const JOINTS = [
  { key: 'base', label: 'Base', min: 0, max: 180, unit: 'deg' },
  { key: 'shoulder', label: 'Shoulder', min: 0, max: 180, unit: 'deg' },
  { key: 'elbow', label: 'Elbow', min: 0, max: 180, unit: 'deg' },
  { key: 'forearm', label: 'Forearm', min: 0, max: 180, unit: 'deg' },
  { key: 'wrist', label: 'Wrist', min: 0, max: 180, unit: 'deg' },
  { key: 'gripper', label: 'Gripper', min: 0, max: 90, unit: 'deg' },
];

export const GESTURES = [
  { key: 'OPEN_HAND', label: 'Open Hand', shortLabel: 'Open', description: 'All fingers extended and spread' },
  { key: 'FIST', label: 'Fist', shortLabel: 'Fist', description: 'All fingers and thumb closed' },
  { key: 'THUMBS_UP', label: 'Thumbs Up', shortLabel: 'Thumb', description: 'Thumb raised with fingers closed' },
  { key: 'INDEX_ONLY', label: 'Point', shortLabel: 'Point', description: 'Index finger extended' },
  { key: 'VICTORY', label: 'Victory', shortLabel: 'Victory', description: 'Index and middle fingers extended' },
];

export const clampJointValue = (jointKey, value) => {
  const joint = JOINTS.find((item) => item.key === jointKey);
  if (!joint) return Math.round(value ?? 0);
  return Math.min(joint.max, Math.max(joint.min, Math.round(value ?? joint.min)));
};

export const normalizePosition = (position = {}) => {
  return JOINTS.reduce((next, joint) => {
    next[joint.key] = clampJointValue(joint.key, position[joint.key] ?? HOME_POSITION[joint.key]);
    return next;
  }, {});
};

