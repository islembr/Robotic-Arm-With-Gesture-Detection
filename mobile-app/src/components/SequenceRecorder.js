import React, { useRef, useState } from 'react';
import { Alert, Animated, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { JOINTS, normalizePosition } from '../config/arm';

function StepRow({ step, index, onDelete }) {
  return (
    <View style={styles.stepRow}>
      <View style={styles.stepNumBadge}>
        <Text style={styles.stepNumText}>{index + 1}</Text>
      </View>
      <View style={styles.stepValues}>
        {JOINTS.map((joint) => (
          <View key={joint.key} style={styles.jointCell}>
            <Text style={styles.jointLabel}>{joint.key.slice(0, 3)}</Text>
            <Text style={styles.jointValue}>{step[joint.key]}</Text>
          </View>
        ))}
      </View>
      <View style={styles.delayBadge}>
        <Text style={styles.delayText}>{step.delay}ms</Text>
      </View>
      <TouchableOpacity style={styles.stepDeleteBtn} onPress={() => onDelete(index)}>
        <Text style={styles.stepDeleteText}>Del</Text>
      </TouchableOpacity>
    </View>
  );
}

export default function SequenceRecorder({ currentPosition, onSave, onCancel, gestureLabel = '' }) {
  const [steps, setSteps] = useState([]);
  const [recording, setRecording] = useState(false);
  const [stepDelay, setStepDelay] = useState(500);
  const flashAnim = useRef(new Animated.Value(1)).current;

  const flashFeedback = () => {
    Animated.sequence([
      Animated.timing(flashAnim, { toValue: 0.35, duration: 80, useNativeDriver: true }),
      Animated.timing(flashAnim, { toValue: 1, duration: 180, useNativeDriver: true }),
    ]).start();
  };

  const handleAddStep = () => {
    if (!recording) return;
    setSteps((current) => [...current, { ...normalizePosition(currentPosition), delay: stepDelay }]);
    flashFeedback();
  };

  const handleDeleteStep = (index) => {
    Alert.alert('Remove step', `Remove step ${index + 1}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => setSteps((current) => current.filter((_, i) => i !== index)) },
    ]);
  };

  const handleStartRecording = () => {
    setSteps([]);
    setRecording(true);
  };

  const handleStopRecording = () => {
    if (steps.length === 0) {
      Alert.alert('No steps', 'Add at least one arm position before finishing.');
      return;
    }
    setRecording(false);
  };

  const handleSave = () => {
    if (steps.length === 0) {
      Alert.alert('Empty sequence', 'Record at least one step first.');
      return;
    }
    onSave(steps);
  };

  const handleClear = () => {
    Alert.alert('Clear steps', 'Remove all recorded steps?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear', style: 'destructive', onPress: () => { setSteps([]); setRecording(false); } },
    ]);
  };

  const cycleDelay = () => {
    const options = [200, 300, 500, 750, 1000, 1500];
    const index = options.indexOf(stepDelay);
    setStepDelay(options[(index + 1) % options.length]);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{gestureLabel ? `Recording: ${gestureLabel}` : 'Sequence Recorder'}</Text>
        <Text style={styles.subtitle}>
          {recording ? 'Move the sliders, then add each arm position.' : steps.length > 0 ? `${steps.length} steps recorded` : 'Start recording to capture servo positions.'}
        </Text>
      </View>

      {recording && (
        <Animated.View style={[styles.recIndicator, { opacity: flashAnim }]}>
          <View style={styles.recDot} />
          <Text style={styles.recText}>RECORDING</Text>
        </Animated.View>
      )}

      <View style={styles.posPreview}>
        <Text style={styles.posPreviewTitle}>Current arm position</Text>
        <View style={styles.posGrid}>
          {JOINTS.map((joint) => (
            <View key={joint.key} style={styles.posCell}>
              <Text style={styles.posCellLabel}>{joint.key}</Text>
              <Text style={styles.posCellValue}>{currentPosition?.[joint.key] ?? 0}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.delayRow}>
        <Text style={styles.delayLabel}>Pause after each step</Text>
        <TouchableOpacity style={styles.delayToggle} onPress={cycleDelay}>
          <Text style={styles.delayToggleText}>{stepDelay}ms</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.controls}>
        {!recording && steps.length === 0 && (
          <TouchableOpacity style={styles.btnStart} onPress={handleStartRecording}>
            <Text style={styles.btnText}>Start Recording</Text>
          </TouchableOpacity>
        )}

        {recording && (
          <View style={styles.controlRow}>
            <TouchableOpacity style={styles.btnAddStep} onPress={handleAddStep}>
              <Text style={styles.btnText}>Add Step ({steps.length})</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.btnDone} onPress={handleStopRecording}>
              <Text style={styles.btnText}>Done</Text>
            </TouchableOpacity>
          </View>
        )}

        {!recording && steps.length > 0 && (
          <View style={styles.controlRow}>
            <TouchableOpacity style={styles.btnReRecord} onPress={handleStartRecording}>
              <Text style={styles.btnText}>Re-record</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.btnSave} onPress={handleSave}>
              <Text style={styles.btnText}>Save</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {steps.length > 0 && (
        <View style={styles.stepsList}>
          <View style={styles.stepsHeader}>
            <Text style={styles.stepsTitle}>Steps</Text>
            <TouchableOpacity onPress={handleClear}>
              <Text style={styles.clearBtn}>Clear all</Text>
            </TouchableOpacity>
          </View>
          <FlatList
            data={steps}
            keyExtractor={(_, index) => index.toString()}
            scrollEnabled={false}
            renderItem={({ item, index }) => <StepRow step={item} index={index} onDelete={handleDeleteStep} />}
          />
        </View>
      )}

      {onCancel && (
        <TouchableOpacity style={styles.btnCancel} onPress={onCancel}>
          <Text style={styles.btnCancelText}>Back</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { marginBottom: 16 },
  title: { fontSize: 18, fontWeight: '700', color: '#2d3436', marginBottom: 4 },
  subtitle: { fontSize: 13, color: '#636e72' },
  recIndicator: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff5f5', borderRadius: 8, padding: 10, marginBottom: 12 },
  recDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#d63031', marginRight: 8 },
  recText: { color: '#d63031', fontWeight: '700', fontSize: 13, letterSpacing: 1 },
  posPreview: { backgroundColor: '#f8f9fa', borderRadius: 8, padding: 12, marginBottom: 12 },
  posPreviewTitle: { fontSize: 12, color: '#636e72', marginBottom: 8 },
  posGrid: { flexDirection: 'row', justifyContent: 'space-between' },
  posCell: { alignItems: 'center', minWidth: 46 },
  posCellLabel: { fontSize: 10, color: '#636e72', textTransform: 'capitalize' },
  posCellValue: { fontSize: 15, fontWeight: '700', color: '#2d3436' },
  delayRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  delayLabel: { fontSize: 13, color: '#636e72' },
  delayToggle: { backgroundColor: '#dfe6e9', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 6 },
  delayToggleText: { fontSize: 13, fontWeight: '700', color: '#2d3436' },
  controls: { marginBottom: 16 },
  controlRow: { flexDirection: 'row', gap: 10 },
  btnStart: { backgroundColor: '#e17055', padding: 14, borderRadius: 8, alignItems: 'center' },
  btnAddStep: { flex: 1, backgroundColor: '#0984e3', padding: 14, borderRadius: 8, alignItems: 'center' },
  btnDone: { flex: 1, backgroundColor: '#636e72', padding: 14, borderRadius: 8, alignItems: 'center' },
  btnReRecord: { flex: 1, backgroundColor: '#e17055', padding: 14, borderRadius: 8, alignItems: 'center' },
  btnSave: { flex: 1, backgroundColor: '#00b894', padding: 14, borderRadius: 8, alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  stepsList: { backgroundColor: '#fff', borderRadius: 8, padding: 14, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, elevation: 3 },
  stepsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  stepsTitle: { fontSize: 14, fontWeight: '700', color: '#2d3436' },
  clearBtn: { color: '#d63031', fontSize: 13, fontWeight: '700' },
  stepRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f8f8f8' },
  stepNumBadge: { width: 26, height: 26, borderRadius: 13, backgroundColor: '#dfe6e9', alignItems: 'center', justifyContent: 'center', marginRight: 8 },
  stepNumText: { fontSize: 11, fontWeight: '700', color: '#636e72' },
  stepValues: { flex: 1, flexDirection: 'row' },
  jointCell: { flex: 1, alignItems: 'center' },
  jointLabel: { fontSize: 10, color: '#8a97a3', textTransform: 'uppercase' },
  jointValue: { fontSize: 12, fontWeight: '700', color: '#2d3436' },
  delayBadge: { backgroundColor: '#f0f7ff', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, marginHorizontal: 6 },
  delayText: { fontSize: 11, color: '#0984e3', fontWeight: '700' },
  stepDeleteBtn: { padding: 6 },
  stepDeleteText: { color: '#d63031', fontSize: 12, fontWeight: '700' },
  btnCancel: { alignItems: 'center', padding: 14, marginTop: 8 },
  btnCancelText: { color: '#636e72', fontSize: 14, fontWeight: '700' },
});
