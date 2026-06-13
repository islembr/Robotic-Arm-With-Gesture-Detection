import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { JOINTS, clampJointValue } from '../config/arm';

const STEP_SIZE = 10;

export default function ArmSliders({ position, onChange, disabled = false }) {
  const handleStep = (jointKey, delta) => {
    onChange({
      ...position,
      [jointKey]: clampJointValue(jointKey, (position[jointKey] ?? 0) + delta),
    });
  };

  return (
    <View style={styles.container}>
      {JOINTS.map((joint) => {
        const value = position[joint.key] ?? 0;
        const progress = ((value - joint.min) / (joint.max - joint.min)) * 100;
        const atMin = value <= joint.min;
        const atMax = value >= joint.max;

        return (
          <View key={joint.key} style={styles.row}>
            <View style={styles.labelRow}>
              <Text style={styles.label}>{joint.label}</Text>
              <Text style={styles.value}>
                {value} {joint.unit}
              </Text>
            </View>

            <View style={styles.controlRow}>
              <TouchableOpacity
                disabled={disabled || atMin}
                style={[styles.stepButton, (disabled || atMin) && styles.stepButtonDisabled]}
                onPress={() => handleStep(joint.key, -STEP_SIZE)}
              >
                <Text style={styles.stepButtonText}>-</Text>
              </TouchableOpacity>

              <View style={styles.rangeTrack}>
                <View style={[styles.rangeFill, { width: `${progress}%` }]} />
              </View>

              <TouchableOpacity
                disabled={disabled || atMax}
                style={[styles.stepButton, (disabled || atMax) && styles.stepButtonDisabled]}
                onPress={() => handleStep(joint.key, STEP_SIZE)}
              >
                <Text style={styles.stepButtonText}>+</Text>
              </TouchableOpacity>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 14 },
  row: { gap: 8 },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: { fontSize: 14, color: '#2d3436', fontWeight: '600' },
  value: { fontSize: 13, fontWeight: '700', color: '#00a383' },
  controlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  stepButton: {
    width: 44,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#0984e3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepButtonDisabled: {
    backgroundColor: '#b2bec3',
  },
  stepButtonText: {
    color: '#fff',
    fontSize: 22,
    lineHeight: 24,
    fontWeight: '800',
  },
  rangeTrack: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#dfe6e9',
    overflow: 'hidden',
  },
  rangeFill: {
    height: 8,
    borderRadius: 4,
    backgroundColor: '#00b894',
  },
});
