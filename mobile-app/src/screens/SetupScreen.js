import React, { useEffect, useRef, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import ArmSliders from '../components/ArmSliders';
import GesturePicker from '../components/GesturePicker';
import SequenceRecorder from '../components/SequenceRecorder';
import { API_CONFIG, HOME_POSITION, MQTT_CONFIG, normalizePosition } from '../config/arm';
import mqtt from '../services/mqtt';
import { saveMappingToBackend } from '../services/mappingsApi';
import { deleteSequence, loadSequences, saveSequence } from '../services/sequenceStore';

const CONFIRM_HOLD_MS = 2000;

export default function SetupScreen() {
  const [step, setStep] = useState(1);
  const [selectedGesture, setSelectedGesture] = useState(null);
  const [sequences, setSequences] = useState({});
  const [position, setPosition] = useState(HOME_POSITION);
  const [confirming, setConfirming] = useState(false);
  const [confirmProgress, setConfirmProgress] = useState(0);
  const [detectedGesture, setDetectedGesture] = useState(null);
  const [confidence, setConfidence] = useState(0);
  const [feedback, setFeedback] = useState('');

  const progressTimer = useRef(null);
  const confirmStart = useRef(null);

  useEffect(() => {
    loadSequences().then(setSequences);
    return () => clearInterval(progressTimer.current);
  }, []);

  useEffect(() => {
    const unsubscribe = mqtt.subscribe(MQTT_CONFIG.topics.gesturePreview, (data) => {
      setDetectedGesture(data.gesture ?? 'UNKNOWN');
      setConfidence(data.confidence ?? 0);
      if (step === 2 && confirming && data.gesture !== selectedGesture?.key) {
        cancelConfirm();
      }
    });
    return unsubscribe;
  }, [step, confirming, selectedGesture]);

  const handleSelect = (gesture) => {
    setSelectedGesture(gesture);
    setStep(2);
    setConfirmProgress(0);
  };

  const handleDelete = async (gestureKey) => {
    Alert.alert('Delete sequence', `Delete the sequence for ${gestureKey}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => setSequences(await deleteSequence(gestureKey)),
      },
    ]);
  };

  const cancelConfirm = () => {
    clearInterval(progressTimer.current);
    setConfirming(false);
    setConfirmProgress(0);
  };

  const startConfirm = () => {
    if (detectedGesture !== selectedGesture?.key) {
      Alert.alert('Wrong gesture', `Make the ${selectedGesture?.label} gesture first, then confirm.`);
      return;
    }

    setConfirming(true);
    confirmStart.current = Date.now();
    progressTimer.current = setInterval(() => {
      const elapsed = Date.now() - confirmStart.current;
      const progress = Math.min(elapsed / CONFIRM_HOLD_MS, 1);
      setConfirmProgress(progress);

      if (progress >= 1) {
        clearInterval(progressTimer.current);
        setConfirming(false);
        setConfirmProgress(0);
        setPosition(HOME_POSITION);
        mqtt.publishControl(HOME_POSITION);
        setStep(3);
      }
    }, 50);
  };

  const handlePositionStep = (newPosition) => {
    const next = normalizePosition(newPosition);
    setPosition(next);
    mqtt.publishControl(next);
    setFeedback('');
  };

  const handleHome = () => {
    const next = normalizePosition(HOME_POSITION);
    setPosition(next);
    const sent = mqtt.publishControl(next);
    setFeedback(sent ? 'Initial position sent to the arm.' : 'Initial position was not sent. MQTT is not connected yet.');
  };

  const handleSequenceSave = async (steps) => {
    try {
      const updated = await saveSequence(selectedGesture.key, steps);
      setSequences(updated);

      const mqttPayload = { gesture: selectedGesture.key, steps };
      console.log(`Saving sequence for ${selectedGesture.key}`, JSON.stringify(mqttPayload));
      mqtt.publishSequence(selectedGesture.key, steps);
    } catch (error) {
      console.error(error);
      Alert.alert('Save failed', error.message || 'Could not save sequence locally.');
      return;
    }

    try {
      await saveMappingToBackend({
        gesture: selectedGesture.key,
        movement: selectedGesture.label,
        sequence: steps,
      });

      Alert.alert('Sequence saved', `${selectedGesture.label} now has ${steps.length} programmed steps.`, [
        { text: 'OK', onPress: resetFlow },
      ]);
    } catch (error) {
      console.error(error);
      Alert.alert(
        'Saved locally',
        `The sequence was saved on the phone, but it could not sync to the backend. Check that the API is running and the phone can open ${API_CONFIG.baseUrl}/mappings.`,
      );
    }
  };

  const resetFlow = () => {
    cancelConfirm();
    setStep(1);
    setSelectedGesture(null);
    setPosition(HOME_POSITION);
    setFeedback('');
  };

  return (
    <View style={styles.container}>
      <View style={styles.stepRow}>
        {[1, 2, 3].map((item) => (
          <View key={item} style={[styles.dot, item === step && styles.dotActive, item < step && styles.dotDone]}>
            <Text style={styles.dotText}>{item}</Text>
          </View>
        ))}
      </View>

      {step === 1 && (
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.title}>Select a Gesture</Text>
          <Text style={styles.subtitle}>Choose the gesture that will trigger a robotic arm task.</Text>
          <GesturePicker sequences={sequences} selectedGesture={selectedGesture?.key} onSelect={handleSelect} onDelete={handleDelete} />
        </ScrollView>
      )}

      {step === 2 && (
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.title}>Confirm Gesture</Text>
          <Text style={styles.subtitle}>Make the selected gesture in front of the PC camera before programming the arm.</Text>

          <View style={styles.card}>
            <Text style={styles.targetCode}>{selectedGesture?.key}</Text>
            <Text style={styles.targetLabel}>Target: {selectedGesture?.label}</Text>

            <View style={styles.detectedRow}>
              <Text style={styles.detectedLabel}>Camera sees</Text>
              <Text style={[styles.detectedValue, detectedGesture === selectedGesture?.key ? styles.detectedMatch : styles.detectedMiss]}>
                {detectedGesture || 'Waiting'}
              </Text>
            </View>
            <Text style={styles.confidenceText}>Confidence: {Math.round((confidence || 0) * 100)}%</Text>

            {confirming && (
              <View style={styles.confBarBg}>
                <View style={[styles.confBarFill, { width: `${confirmProgress * 100}%` }]} />
              </View>
            )}

            <TouchableOpacity
              style={[styles.btnConfirm, detectedGesture !== selectedGesture?.key && styles.btnDisabled]}
              onPress={confirming ? cancelConfirm : startConfirm}
            >
              <Text style={styles.btnText}>{confirming ? 'Hold still...' : 'Confirm Gesture'}</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.btnBack} onPress={resetFlow}>
            <Text style={styles.btnBackText}>Back</Text>
          </TouchableOpacity>
        </ScrollView>
      )}

      {step === 3 && (
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.title}>Record Arm Task</Text>
          <Text style={styles.subtitle}>Move each joint with + and - buttons, add steps, then save the gesture mapping.</Text>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Arm Position</Text>
            <TouchableOpacity style={styles.btnHome} onPress={handleHome}>
              <Text style={styles.btnText}>Initial Position</Text>
            </TouchableOpacity>
            {feedback ? (
              <View style={styles.feedbackBox}>
                <Text style={styles.feedbackText}>{feedback}</Text>
              </View>
            ) : null}
            <ArmSliders position={position} onChange={handlePositionStep} />
          </View>

          <SequenceRecorder
            currentPosition={position}
            gestureLabel={selectedGesture?.label}
            onSave={handleSequenceSave}
            onCancel={() => setStep(2)}
          />
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f6fa' },
  content: { padding: 16, paddingBottom: 60 },
  title: { fontSize: 22, fontWeight: '700', color: '#2d3436', marginBottom: 4 },
  subtitle: { fontSize: 13, color: '#636e72', marginBottom: 20, lineHeight: 18 },
  card: { backgroundColor: '#fff', borderRadius: 8, padding: 16, marginBottom: 16, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, elevation: 3 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#2d3436', marginBottom: 12 },
  stepRow: { flexDirection: 'row', justifyContent: 'center', gap: 12, padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  dot: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#dfe6e9', alignItems: 'center', justifyContent: 'center' },
  dotActive: { backgroundColor: '#0984e3' },
  dotDone: { backgroundColor: '#00b894' },
  dotText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  targetCode: { fontSize: 18, textAlign: 'center', color: '#0984e3', fontWeight: '800', marginBottom: 8 },
  targetLabel: { fontSize: 16, textAlign: 'center', color: '#2d3436', fontWeight: '700', marginBottom: 16 },
  detectedRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  detectedLabel: { fontSize: 14, color: '#636e72' },
  detectedValue: { fontSize: 14, fontWeight: '800' },
  detectedMatch: { color: '#00a383' },
  detectedMiss: { color: '#d63031' },
  confidenceText: { color: '#636e72', fontSize: 13, marginBottom: 16, textAlign: 'right' },
  confBarBg: { height: 8, backgroundColor: '#f0f0f0', borderRadius: 4, marginBottom: 16 },
  confBarFill: { height: 8, backgroundColor: '#0984e3', borderRadius: 4 },
  btnConfirm: { backgroundColor: '#0984e3', padding: 14, borderRadius: 8, alignItems: 'center' },
  btnDisabled: { backgroundColor: '#b2bec3' },
  btnBack: { alignItems: 'center', padding: 12 },
  btnBackText: { color: '#636e72', fontSize: 14, fontWeight: '700' },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  btnHome: { backgroundColor: '#0984e3', padding: 14, borderRadius: 8, alignItems: 'center', marginBottom: 12 },
  feedbackBox: { backgroundColor: '#e8f8f4', borderRadius: 8, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: '#b8eadc' },
  feedbackText: { color: '#007f69', fontSize: 13, fontWeight: '700' },
});

