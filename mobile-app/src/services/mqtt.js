import * as Mqtt from 'mqtt';

import { MQTT_CONFIG } from '../config/arm';

const CLIENT_ID = `arm_app_${Math.random().toString(16).slice(2, 10)}`;

const getMqttConnect = () => {
  const connector = Mqtt.connect || Mqtt.default?.connect || Mqtt.default?.default?.connect;
  if (!connector) {
    throw new Error(`MQTT connect function not found. Available exports: ${Object.keys(Mqtt).join(', ')}`);
  }
  return connector;
};

class MQTTService {
  constructor() {
    this.client = null;
    this.topicListeners = new Map();
    this.connectionListeners = new Set();
    this.connectionState = 'disconnected';
  }

  connect() {
    if (this.client) return this.client;

    this.setConnectionState('connecting');
    this.client = getMqttConnect()(MQTT_CONFIG.brokerUrl, {
      clientId: CLIENT_ID,
      clean: true,
      connectTimeout: 8000,
      reconnectPeriod: 2500,
    });

    this.client.on('connect', () => {
      this.setConnectionState('connected');
      this.client.subscribe([
        MQTT_CONFIG.topics.status,
        MQTT_CONFIG.topics.gesture,
        MQTT_CONFIG.topics.gesturePreview,
        MQTT_CONFIG.topics.activity,
        MQTT_CONFIG.topics.log,
      ]);
    });

    this.client.on('reconnect', () => this.setConnectionState('reconnecting'));
    this.client.on('close', () => this.setConnectionState('disconnected'));
    this.client.on('offline', () => this.setConnectionState('offline'));
    this.client.on('error', () => this.setConnectionState('error'));

    this.client.on('message', (topic, payload) => {
      const listeners = this.topicListeners.get(topic) ?? [];
      if (listeners.length === 0) return;

      let data;
      try {
        data = JSON.parse(payload.toString());
      } catch {
        data = { raw: payload.toString() };
      }

      listeners.forEach((callback) => callback(data));
    });

    return this.client;
  }

  setConnectionState(nextState) {
    this.connectionState = nextState;
    this.connectionListeners.forEach((callback) => callback(nextState));
  }

  publish(topic, payload) {
    this.connect();
    if (!this.client?.connected) return false;
    console.log(`MQTT => ${topic}`, JSON.stringify(payload));
    this.client.publish(topic, JSON.stringify(payload));
    return true;
  }

  publishControl(position) {
    return this.publish(MQTT_CONFIG.topics.control, position);
  }

  publishSequence(gesture, steps) {
    return this.publish(MQTT_CONFIG.topics.sequenceSave, { gesture, steps });
  }

  subscribe(topic, callback) {
    const listeners = this.topicListeners.get(topic) ?? [];
    this.topicListeners.set(topic, [...listeners, callback]);
    this.connect();

    return () => {
      const current = this.topicListeners.get(topic) ?? [];
      this.topicListeners.set(topic, current.filter((item) => item !== callback));
    };
  }

  subscribeConnection(callback) {
    this.connectionListeners.add(callback);
    callback(this.connectionState);
    this.connect();
    return () => this.connectionListeners.delete(callback);
  }

  disconnect() {
    this.client?.end(true);
    this.client = null;
    this.setConnectionState('disconnected');
  }
}

export default new MQTTService();

