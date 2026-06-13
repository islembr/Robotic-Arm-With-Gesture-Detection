import { Injectable } from '@nestjs/common';
import {
  ActivityItem,
  AlertItem,
  ConnectionState,
  DashboardStats,
  HistoryItem,
  MonitoringLive,
} from '../../common/types';

interface HistoryFilters {
  date?: string;
  gesture?: string;
  result?: string;
}

interface LiveState {
  detectedGesture: string;
  associatedMovement: string;
  armState: string;
  lastUpdate: string;
  confidence: number;
  batteryLevel?: number;
}

@Injectable()
export class IotStateService {
  private mqttConnected = false;
  private lastDeviceUpdate = 0;
  private eventCounter = 0;
  private live: LiveState = {
    detectedGesture: 'Not available',
    associatedMovement: 'Not available',
    armState: 'Not available',
    lastUpdate: new Date().toISOString(),
    confidence: 0,
  };
  private readonly feed: ActivityItem[] = [];
  private readonly history: HistoryItem[] = [];
  private readonly alerts: AlertItem[] = [];

  setMqttConnected(connected: boolean) {
    this.mqttConnected = connected;
    this.pushFeed({
      title: connected ? 'MQTT connecte' : 'MQTT deconnecte',
      detail: connected ? 'Connexion au broker Shiftr active.' : 'Le broker MQTT est indisponible.',
      type: connected ? 'system' : 'alert',
    });
  }

  ingestMqttMessage(topic: string, rawPayload: string) {
    const payload = this.parsePayload(rawPayload);

    if (topic.includes('alert')) {
      this.addAlertFromPayload(payload, rawPayload);
      return;
    }

    if (topic.includes('gesture')) {
      this.updateGesture(payload, rawPayload);
      return;
    }

    this.updateDeviceStatus(payload, rawPayload);
  }

  recordGestureExecution(input: {
    gesture: string;
    movement: string;
    confidence: number;
    result: HistoryItem['result'];
    notes: string;
  }) {
    const now = new Date();

    this.live = {
      ...this.live,
      detectedGesture: input.gesture,
      associatedMovement: input.movement,
      armState: input.result === 'success' ? 'Sequence envoyee' : 'Execution impossible',
      confidence: input.confidence,
      lastUpdate: now.toISOString(),
    };

    this.pushFeed({
      title: `Geste detecte: ${input.gesture}`,
      detail: input.result === 'success'
        ? `Sequence "${input.movement}" envoyee au bras.`
        : input.notes,
      type: input.result === 'success' ? 'movement' : 'alert',
    });

    this.history.unshift({
      id: this.nextId('hist'),
      dateTime: this.formatDateTime(now),
      user: 'Utilisateur suivi',
      detectedGesture: input.gesture,
      executedMovement: input.result === 'success' ? input.movement : 'Not available',
      result: input.result,
      notes: input.notes,
    });
    this.trim(this.history, 30);
  }

  createAlert(title: string, description: string, severity: AlertItem['severity'] = 'medium') {
    const now = new Date();

    this.alerts.unshift({
      id: this.nextId('alert'),
      title,
      severity,
      dateTime: this.formatDateTime(now),
      status: 'new',
      description,
    });
    this.trim(this.alerts, 30);

    this.pushFeed({
      title,
      detail: description,
      type: 'alert',
    });
  }

  getMonitoringLive(mock: MonitoringLive): MonitoringLive {
    const hasLiveData = this.lastDeviceUpdate > 0 || this.feed.length > 0;
    if (!hasLiveData) {
      return {
        ...mock,
        connectionStatus: this.getConnectionState(),
        lastUpdate: new Date().toISOString(),
      };
    }

    return {
      ...mock,
      detectedGesture: this.live.detectedGesture,
      associatedMovement: this.live.associatedMovement,
      armState: this.live.armState,
      connectionStatus: this.getConnectionState(),
      lastUpdate: this.live.lastUpdate,
      confidence: this.live.confidence,
      feed: [...this.feed, ...mock.feed].slice(0, 12),
    };
  }

  getDashboardStats(mock: DashboardStats, savedGestures: number, alertsToday: number): DashboardStats {
    return {
      ...mock,
      armStatus: this.getConnectionState(),
      lastDetectedGesture: this.live.detectedGesture,
      lastExecutedMovement: this.live.associatedMovement,
      batteryLevel: this.live.batteryLevel ?? mock.batteryLevel,
      savedGestures,
      alertsToday,
      recentActivity: [...this.feed, ...mock.recentActivity].slice(0, 6),
    };
  }

  getHistory(mockHistory: HistoryItem[], filters: HistoryFilters): HistoryItem[] {
    return [...this.history, ...mockHistory].filter((item) => {
      const matchesDate = filters.date ? item.dateTime.startsWith(filters.date) : true;
      const matchesGesture = filters.gesture ? item.detectedGesture === filters.gesture : true;
      const matchesResult = filters.result ? item.result === filters.result : true;
      return matchesDate && matchesGesture && matchesResult;
    });
  }

  getAlerts(mockAlerts: AlertItem[]): AlertItem[] {
    return [...this.alerts, ...mockAlerts];
  }

  resolveAlert(id: string): AlertItem | undefined {
    const alert = this.alerts.find((item) => item.id === id);
    if (alert) {
      alert.status = 'resolved';
    }
    return alert;
  }

  getConnectionState(): ConnectionState {
    if (!this.mqttConnected) {
      return 'disconnected';
    }

    if (this.lastDeviceUpdate === 0) {
      return 'degraded';
    }

    const secondsSinceUpdate = (Date.now() - this.lastDeviceUpdate) / 1000;
    return secondsSinceUpdate <= 15 ? 'connected' : 'degraded';
  }

  private updateDeviceStatus(payload: Record<string, unknown>, rawPayload: string) {
    this.lastDeviceUpdate = Date.now();
    const now = new Date();
    const receivedGesture = this.getString(payload.gesture);
    const gesture = receivedGesture && receivedGesture !== 'NONE' ? receivedGesture : this.live.detectedGesture;
    const action = this.getString(payload.action) ?? this.getString(payload.msg) ?? 'Etat ESP32 recu';
    const movement = this.getString(payload.movement) ?? this.getString(payload.associatedMovement) ?? this.describeMovement(payload);

    this.live = {
      detectedGesture: gesture,
      associatedMovement: movement,
      armState: action,
      lastUpdate: now.toISOString(),
      confidence: this.getConfidence(payload) ?? this.live.confidence,
      batteryLevel: this.getNumber(payload.battery) ?? this.getNumber(payload.batteryLevel) ?? this.live.batteryLevel,
    };

    const message = this.getString(payload.msg);
    const isHeartbeat = action.toLowerCase().includes('heartbeat') || message?.toLowerCase().includes('heartbeat');
    if (!isHeartbeat) {
      this.pushFeed({
        title: 'Etat ESP32 recu',
        detail: message ?? rawPayload,
        type: 'system',
      });
    }
  }

  private updateGesture(payload: Record<string, unknown>, rawPayload: string) {
    const now = new Date();
    const gesture = this.getString(payload.gesture) ?? this.getString(payload.name) ?? rawPayload;
    const confidence = this.getConfidence(payload) ?? 0;
    const movement = this.getString(payload.movement) ?? this.getString(payload.associatedMovement) ?? 'Not available';

    this.live = {
      ...this.live,
      detectedGesture: gesture,
      associatedMovement: movement,
      confidence,
      lastUpdate: now.toISOString(),
    };

    this.pushFeed({
      title: `Geste detecte: ${gesture}`,
      detail: confidence > 0 ? `Confiance ${Math.round(confidence * 100)}%.` : 'Geste recu depuis le flux MQTT.',
      type: 'gesture',
    });

    this.history.unshift({
      id: this.nextId('hist'),
      dateTime: this.formatDateTime(now),
      user: 'Utilisateur suivi',
      detectedGesture: gesture,
      executedMovement: movement,
      result: gesture === 'UNKNOWN' ? 'failed' : 'success',
      notes: 'Evenement recu depuis MQTT.',
    });
    this.trim(this.history, 30);
  }

  private addAlertFromPayload(payload: Record<string, unknown>, rawPayload: string) {
    const now = new Date();
    const title = this.getString(payload.title) ?? this.getString(payload.type) ?? 'Alerte IoT';
    const severity = this.getSeverity(payload.severity);

    this.alerts.unshift({
      id: this.nextId('alert'),
      title,
      severity,
      dateTime: this.formatDateTime(now),
      status: 'new',
      description: this.getString(payload.description) ?? this.getString(payload.message) ?? rawPayload,
    });
    this.trim(this.alerts, 30);

    this.pushFeed({
      title,
      detail: `Alerte ${severity} recue depuis MQTT.`,
      type: 'alert',
    });
  }

  private describeMovement(payload: Record<string, unknown>) {
    const command = this.getString(payload.cmd);
    if (command === 'move') {
      return 'Mouvement manuel recu';
    }
    return this.live.associatedMovement;
  }

  private pushFeed(event: Omit<ActivityItem, 'id' | 'time'>) {
    this.feed.unshift({
      id: this.nextId('feed'),
      time: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
      ...event,
    });
    this.trim(this.feed, 20);
  }

  private parsePayload(rawPayload: string): Record<string, unknown> {
    try {
      const parsed = JSON.parse(rawPayload) as unknown;
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
    } catch {
      return { message: rawPayload };
    }
  }

  private getString(value: unknown) {
    return typeof value === 'string' && value.trim().length > 0 ? value : undefined;
  }

  private getNumber(value: unknown) {
    return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
  }

  private getConfidence(payload: Record<string, unknown>) {
    const confidence = this.getNumber(payload.confidence);
    if (confidence === undefined) return undefined;
    return confidence > 1 ? confidence / 100 : confidence;
  }

  private getSeverity(value: unknown): AlertItem['severity'] {
    return value === 'low' || value === 'medium' || value === 'high' ? value : 'medium';
  }

  private formatDateTime(date: Date) {
    return date.toISOString().slice(0, 16).replace('T', ' ');
  }

  private nextId(prefix: string) {
    this.eventCounter += 1;
    return `${prefix}-${Date.now()}-${this.eventCounter}`;
  }

  private trim<T>(items: T[], max: number) {
    if (items.length > max) {
      items.splice(max);
    }
  }
}
