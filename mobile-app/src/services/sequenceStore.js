import AsyncStorage from '@react-native-async-storage/async-storage';

import { normalizePosition } from '../config/arm';

const KEY = 'gesture_sequences';

const normalizeSteps = (steps = []) => {
  return steps.map((step) => ({
    ...normalizePosition(step),
    delay: Math.max(0, Math.round(step.delay ?? step.delayMs ?? 500)),
  }));
};

export async function loadSequences() {
  const raw = await AsyncStorage.getItem(KEY);
  if (!raw) return {};

  try {
    const parsed = JSON.parse(raw);
    return Object.entries(parsed).reduce((next, [gesture, steps]) => {
      next[gesture] = normalizeSteps(Array.isArray(steps) ? steps : steps.steps);
      return next;
    }, {});
  } catch {
    return {};
  }
}

export async function saveSequence(gesture, steps) {
  const sequences = await loadSequences();
  const next = {
    ...sequences,
    [gesture]: normalizeSteps(steps),
  };
  await AsyncStorage.setItem(KEY, JSON.stringify(next));
  return next;
}

export async function deleteSequence(gesture) {
  const sequences = await loadSequences();
  const next = { ...sequences };
  delete next[gesture];
  await AsyncStorage.setItem(KEY, JSON.stringify(next));
  return next;
}
