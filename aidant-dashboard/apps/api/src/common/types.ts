export type ConnectionState = 'connected' | 'disconnected' | 'degraded';
export type MappingStatus = 'enabled' | 'disabled';
export type InteractionResult = 'success' | 'failed';
export type AlertSeverity = 'low' | 'medium' | 'high';
export type AlertStatus = 'new' | 'resolved';

export interface DashboardStats {
  armStatus: ConnectionState;
  currentUser: string;
  supervisedUser: {
    id: string;
    name: string;
    role: string;
    status: string;
  };
  lastDetectedGesture: string;
  lastExecutedMovement: string;
  batteryLevel: number | null;
  savedGestures: number;
  alertsToday: number;
  recentActivity: ActivityItem[];
  activitySummary: ActivitySummaryItem[];
}

export interface ActivityItem {
  id: string;
  time: string;
  title: string;
  detail: string;
  type: 'gesture' | 'movement' | 'system' | 'alert';
}

export interface ActivitySummaryItem {
  label: string;
  success: number;
  failed: number;
}

export interface MonitoringLive {
  detectedGesture: string;
  associatedMovement: string;
  armState: string;
  connectionStatus: ConnectionState;
  lastUpdate: string;
  confidence: number;
  feed: ActivityItem[];
}

export interface GestureMapping {
  id: string;
  gestureName: string;
  movementName: string;
  createdDate: string;
  lastUsed: string;
  status: MappingStatus;
  notes: string;
  sequence: MovementStep[];
}

export interface MovementStep {
  base: number;
  shoulder: number;
  elbow: number;
  forearm: number;
  wrist: number;
  gripper: number;
  delayMs: number;
}

export interface HistoryItem {
  id: string;
  dateTime: string;
  user: string;
  detectedGesture: string;
  executedMovement: string;
  result: InteractionResult;
  notes: string;
}

export interface AlertItem {
  id: string;
  title: string;
  severity: AlertSeverity;
  dateTime: string;
  status: AlertStatus;
  description: string;
}

export interface ProfileSettings {
  aidantName: string;
  email: string;
  followedUser: string;
  notifications: {
    email: boolean;
    criticalAlerts: boolean;
    dailySummary: boolean;
  };
  connection: {
    broker: string;
    deviceId: string;
    lastSync: string;
  };
}
