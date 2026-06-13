import React, { useCallback, useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import ArmSliders from '../components/ArmSliders';
import { HOME_POSITION, MQTT_CONFIG, normalizePosition } from '../config/arm';
import mqtt from '../services/mqtt';

export default function ControlScreen() {
  const [position, setPosition] = useState(HOME_POSITION);
  const [connection, setConnection] = useState('disconnected');
  const [lastStatus, setLastStatus] = useState(null);
  const [feedback, setFeedback] = useState('');

  useEffect(() => {
    const unsubscribeConnection = mqtt.subscribeConnection(setConnection);
    const unsubscribeStatus = mqtt.subscribe(MQTT_CONFIG.topics.status, (data) => {
      setLastStatus(data);
      if (data.pos) setPosition(normalizePosition(data.pos));
    });

    return () => {
      unsubscribeConnection();
      unsubscribeStatus();
    };
  }, []);

  const handleChange = useCallback((newPosition) => {
    const next = normalizePosition(newPosition);
    setPosition(next);
    mqtt.publishControl(next);
    setFeedback('');
  }, []);

  const handleHome = () => {
    const next = normalizePosition(HOME_POSITION);
    setPosition(next);
    const sent = mqtt.publishControl(next);
    setFeedback(sent ? 'Initial position sent to the arm.' : 'Initial position was not sent. MQTT is not connected yet.');
  };

  const handleStop = () => {
    mqtt.publish(MQTT_CONFIG.topics.control, { ...position, stop: true });
    Alert.alert('Stop sent', 'A stop command was published to the arm control topic.');
  };

  const isConnected = connection === 'connected';

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={[styles.statusBar, { backgroundColor: isConnected ? '#00b894' : '#d63031' }]}>
        <Text style={styles.statusText}>{isConnected ? 'Connected' : connection}</Text>
        <Text style={styles.statusText}>Action: {lastStatus?.action || 'idle'}</Text>
      </View>

      <Text style={styles.title}>Live Arm Control</Text>
      <Text style={styles.subtitle}>Use the + and - buttons to move each joint by 10 degrees before recording a gesture task.</Text>

      <View style={styles.card}>
        <ArmSliders position={position} onChange={handleChange} />
      </View>

      <View style={styles.buttonRow}>
        <TouchableOpacity style={styles.btnHome} onPress={handleHome}>
          <Text style={styles.btnText}>Initial Position</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.btnStop} onPress={handleStop}>
          <Text style={styles.btnText}>Stop</Text>
        </TouchableOpacity>
      </View>

      {feedback ? (
        <View style={styles.feedbackBox}>
          <Text style={styles.feedbackText}>{feedback}</Text>
        </View>
      ) : null}

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Current Position</Text>
        {Object.entries(position).map(([joint, value]) => (
          <View key={joint} style={styles.readoutRow}>
            <Text style={styles.readoutLabel}>{joint}</Text>
            <Text style={styles.readoutValue}>{value} deg</Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f6fa' },
  content: { padding: 16, paddingBottom: 40 },
  statusBar: { flexDirection: 'row', justifyContent: 'space-between', padding: 10, borderRadius: 8, marginBottom: 16 },
  statusText: { color: '#fff', fontWeight: '700', fontSize: 13, textTransform: 'capitalize' },
  title: { fontSize: 22, fontWeight: '700', color: '#2d3436', marginBottom: 4 },
  subtitle: { fontSize: 13, color: '#636e72', marginBottom: 16, lineHeight: 18 },
  card: { backgroundColor: '#fff', borderRadius: 8, padding: 16, marginBottom: 16, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, elevation: 3 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#2d3436', marginBottom: 12 },
  buttonRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  btnHome: { flex: 1, backgroundColor: '#0984e3', padding: 14, borderRadius: 8, alignItems: 'center' },
  btnStop: { flex: 1, backgroundColor: '#d63031', padding: 14, borderRadius: 8, alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  feedbackBox: { backgroundColor: '#e8f8f4', borderRadius: 8, padding: 12, marginBottom: 16, borderWidth: 1, borderColor: '#b8eadc' },
  feedbackText: { color: '#007f69', fontSize: 13, fontWeight: '700' },
  readoutRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  readoutLabel: { color: '#636e72', fontSize: 14, textTransform: 'capitalize' },
  readoutValue: { color: '#2d3436', fontWeight: '700', fontSize: 14 },
});
