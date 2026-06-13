import React, { useEffect, useState } from 'react';
import { FlatList, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { GESTURES, JOINTS, MQTT_CONFIG } from '../config/arm';
import mqtt from '../services/mqtt';

const MAX_LOG_ENTRIES = 100;

const getGestureLabel = (key) => GESTURES.find((gesture) => gesture.key === key)?.label ?? key ?? 'NONE';

const getTime = (value) => {
  if (!value) return new Date().toLocaleTimeString();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? new Date().toLocaleTimeString() : date.toLocaleTimeString();
};

const normalizeActivity = (data, topic) => ({
  id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
  time: getTime(data.timestamp ?? data.time),
  source: data.source ?? (topic === MQTT_CONFIG.topics.activity ? 'esp32' : 'system'),
  gesture: data.gesture ?? 'NONE',
  movement: data.movement ?? data.movementName ?? data.action ?? 'Aucun',
  result: data.result ?? data.status ?? data.action ?? 'info',
  message: data.msg ?? data.message ?? data.raw ?? 'Activity received',
});

export default function MonitorScreen() {
  const [status, setStatus] = useState(null);
  const [gesture, setGesture] = useState({ gesture: 'NONE', confidence: 0 });
  const [latestAction, setLatestAction] = useState(null);
  const [log, setLog] = useState([]);
  const [connection, setConnection] = useState('disconnected');

  useEffect(() => {
    const addLogEntry = (topic) => (data) => {
      const entry = normalizeActivity(data, topic);
      if (topic === MQTT_CONFIG.topics.activity) setLatestAction(entry);
      setLog((current) => [entry, ...current].slice(0, MAX_LOG_ENTRIES));
    };

    const unsubscribeConnection = mqtt.subscribeConnection(setConnection);
    const unsubscribeStatus = mqtt.subscribe(MQTT_CONFIG.topics.status, setStatus);
    const unsubscribeGesture = mqtt.subscribe(MQTT_CONFIG.topics.gesturePreview, setGesture);
    const unsubscribeActivity = mqtt.subscribe(MQTT_CONFIG.topics.activity, addLogEntry(MQTT_CONFIG.topics.activity));
    const unsubscribeLog = mqtt.subscribe(MQTT_CONFIG.topics.log, addLogEntry(MQTT_CONFIG.topics.log));

    return () => {
      unsubscribeConnection();
      unsubscribeStatus();
      unsubscribeGesture();
      unsubscribeActivity();
      unsubscribeLog();
    };
  }, []);

  const clearLog = () => setLog([]);
  const confidence = gesture.confidence ?? 0;
  const confidenceColor = confidence >= 0.9 ? '#00b894' : confidence >= 0.8 ? '#c78300' : '#d63031';
  const connected = connection === 'connected';
  const statusText = status?.status ?? status?.mqtt ?? 'Waiting';
  const actionText = status?.action ?? 'idle';

  const renderLogEntry = ({ item }) => (
    <View style={styles.logEntry}>
      <View style={styles.logTopRow}>
        <Text style={styles.logTime}>{item.time}</Text>
        <Text style={styles.logSource}>{item.source}</Text>
        <Text style={[styles.logResult, styles[`result_${item.result}`] ?? styles.result_info]}>{item.result}</Text>
      </View>
      <Text style={styles.logTitle}>
        {getGestureLabel(item.gesture)} -> {item.movement}
      </Text>
      <Text style={styles.logMessage}>{item.message}</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={[styles.badge, { backgroundColor: connected ? '#00b894' : '#d63031' }]}>
        <Text style={styles.badgeText}>{connected ? 'Live MQTT' : connection}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Detected Gesture</Text>
          <Text style={styles.gestureCode}>{gesture.gesture || 'NONE'}</Text>
          <Text style={styles.gestureName}>{getGestureLabel(gesture.gesture || 'NONE')}</Text>
          <View style={styles.confBarBg}>
            <View style={[styles.confBarFill, { width: `${Math.min(100, confidence * 100)}%`, backgroundColor: confidenceColor }]} />
          </View>
          <Text style={[styles.confText, { color: confidenceColor }]}>
            {confidence ? `${Math.round(confidence * 100)}% confidence` : 'Waiting for camera preview'}
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Arm Status</Text>
          {status ? (
            <>
              <View style={styles.statusRow}>
                <Text style={styles.statusLabel}>Status</Text>
                <Text style={styles.statusValue}>{statusText}</Text>
              </View>
              <View style={styles.statusRow}>
                <Text style={styles.statusLabel}>Action</Text>
                <Text style={[styles.statusValue, actionText === 'executing' && styles.executing]}>{actionText}</Text>
              </View>
              <View style={styles.statusRow}>
                <Text style={styles.statusLabel}>Message</Text>
                <Text style={styles.statusValue}>{status.msg ?? 'No message'}</Text>
              </View>
              {JOINTS.map((joint) => {
                const value = status.pos?.[joint.key] ?? 0;
                return (
                  <View key={joint.key} style={styles.statusRow}>
                    <Text style={styles.statusLabel}>{joint.key}</Text>
                    <View style={styles.posBarBg}>
                      <View style={[styles.posBarFill, { width: `${Math.min(100, (value / joint.max) * 100)}%` }]} />
                    </View>
                    <Text style={styles.posValue}>{value}</Text>
                  </View>
                );
              })}
            </>
          ) : (
            <Text style={styles.noData}>Waiting for arm/status...</Text>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Latest Executed Action</Text>
          {latestAction ? (
            <>
              <Text style={styles.latestTitle}>
                {getGestureLabel(latestAction.gesture)} -> {latestAction.movement}
              </Text>
              <Text style={styles.latestMessage}>{latestAction.result}: {latestAction.message}</Text>
              <Text style={styles.latestTime}>{latestAction.time} from {latestAction.source}</Text>
            </>
          ) : (
            <Text style={styles.noData}>Waiting for arm/activity...</Text>
          )}
        </View>

        <View style={styles.card}>
          <View style={styles.logHeader}>
            <Text style={styles.sectionTitle}>Activity Log</Text>
            <TouchableOpacity onPress={clearLog}>
              <Text style={styles.clearBtn}>Clear</Text>
            </TouchableOpacity>
          </View>

          {log.length === 0 ? (
            <Text style={styles.noData}>No activity received yet</Text>
          ) : (
            <FlatList data={log} keyExtractor={(item) => item.id} renderItem={renderLogEntry} scrollEnabled={false} />
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f6fa' },
  badge: { margin: 16, marginBottom: 0, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, alignSelf: 'flex-start' },
  badgeText: { color: '#fff', fontWeight: '700', fontSize: 13, textTransform: 'capitalize' },
  content: { padding: 16, paddingBottom: 40 },
  card: { backgroundColor: '#fff', borderRadius: 8, padding: 16, marginBottom: 16, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, elevation: 3 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#2d3436', marginBottom: 12 },
  gestureCode: { fontSize: 18, fontWeight: '800', color: '#0984e3', textAlign: 'center', marginBottom: 4 },
  gestureName: { fontSize: 20, fontWeight: '700', textAlign: 'center', color: '#2d3436', marginBottom: 12 },
  confBarBg: { height: 8, backgroundColor: '#f0f0f0', borderRadius: 4, marginBottom: 6 },
  confBarFill: { height: 8, borderRadius: 4 },
  confText: { fontSize: 13, textAlign: 'center', fontWeight: '700' },
  statusRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  statusLabel: { width: 82, color: '#636e72', fontSize: 13, textTransform: 'capitalize' },
  statusValue: { color: '#2d3436', fontWeight: '700', fontSize: 13, flex: 1 },
  executing: { color: '#e17055' },
  posBarBg: { flex: 1, height: 6, backgroundColor: '#f0f0f0', borderRadius: 3, marginHorizontal: 8 },
  posBarFill: { height: 6, backgroundColor: '#00b894', borderRadius: 3 },
  posValue: { width: 40, textAlign: 'right', fontSize: 13, color: '#2d3436', fontWeight: '700' },
  latestTitle: { color: '#2d3436', fontSize: 16, fontWeight: '800', marginBottom: 6 },
  latestMessage: { color: '#636e72', fontSize: 13, marginBottom: 6 },
  latestTime: { color: '#8a97a3', fontSize: 12 },
  logHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  clearBtn: { color: '#d63031', fontSize: 13, fontWeight: '700' },
  logEntry: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f2f4f6' },
  logTopRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 5 },
  logTime: { color: '#8a97a3', fontSize: 12, width: 76 },
  logSource: { color: '#0984e3', fontSize: 12, fontWeight: '700', flex: 1 },
  logResult: { fontSize: 12, fontWeight: '800', textTransform: 'capitalize' },
  result_success: { color: '#00a383' },
  result_started: { color: '#0984e3' },
  result_step_completed: { color: '#6c5ce7' },
  result_stopped: { color: '#e17055' },
  result_error: { color: '#d63031' },
  result_info: { color: '#636e72' },
  logTitle: { color: '#2d3436', fontSize: 13, fontWeight: '700', marginBottom: 3 },
  logMessage: { color: '#636e72', fontSize: 12 },
  noData: { color: '#8a97a3', fontSize: 13, textAlign: 'center', paddingVertical: 12 },
});
