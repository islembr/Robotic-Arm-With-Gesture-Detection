import {
  AlertItem,
  DashboardStats,
  GestureMapping,
  HistoryItem,
  MonitoringLive,
  ProfileSettings,
} from './types';

export const dashboardStats: DashboardStats = {
  armStatus: 'disconnected',
  currentUser: 'Demo Patient',
  supervisedUser: {
    id: 'demo-user-1',
    name: 'Demo Patient',
    role: 'user',
    status: 'Linked demo user',
  },
  lastDetectedGesture: 'Not available',
  lastExecutedMovement: 'Not available',
  batteryLevel: null,
  savedGestures: 0,
  alertsToday: 0,
  recentActivity: [],
  activitySummary: [],
};

export const monitoringLive: MonitoringLive = {
  detectedGesture: 'Not available',
  associatedMovement: 'Not available',
  armState: 'Not available',
  connectionStatus: 'disconnected',
  lastUpdate: new Date().toISOString(),
  confidence: 0,
  feed: [],
};

// No gesture is executable by default. Later, this repository will be backed by MongoDB.
export const mappings: GestureMapping[] = [];

export const historyItems: HistoryItem[] = [];

export const alerts: AlertItem[] = [];

export const profileSettings: ProfileSettings = {
  aidantName: 'Demo Aidant',
  email: 'aidant@demo.com',
  followedUser: 'Demo Patient',
  notifications: {
    email: false,
    criticalAlerts: false,
    dailySummary: false,
  },
  connection: {
    broker: 'Not available',
    deviceId: 'Not available',
    lastSync: 'Not available',
  },
};
