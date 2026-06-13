import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { ActivityIndicator, StatusBar, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import ControlScreen from './src/screens/ControlScreen';
import LoginScreen from './src/screens/LoginScreen';
import MonitorScreen from './src/screens/MonitorScreen';
import SetupScreen from './src/screens/SetupScreen';
import { getStoredSession, logout } from './src/services/auth';
import mqttService from './src/services/mqtt';

const Tab = createBottomTabNavigator();

const TAB_LABELS = {
  Setup: 'SET',
  Control: 'ARM',
  Monitor: 'LOG',
};

export default function App() {
  const [user, setUser] = useState(null);
  const [checkingAuth, setCheckingAuth] = useState(true);

  useEffect(() => {
    getStoredSession()
      .then((session) => setUser(session?.user ?? null))
      .finally(() => setCheckingAuth(false));
  }, []);

  useEffect(() => {
    if (!user) return undefined;
    mqttService.connect();
    return () => mqttService.disconnect();
  }, [user]);

  const handleLogout = async () => {
    await logout();
    mqttService.disconnect();
    setUser(null);
  };

  if (checkingAuth) {
    return (
      <SafeAreaProvider>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f5f6fa' }}>
          <ActivityIndicator color="#0984e3" />
          <Text style={{ marginTop: 10, color: '#636e72', fontWeight: '700' }}>Checking session...</Text>
        </View>
      </SafeAreaProvider>
    );
  }

  if (!user) {
    return (
      <SafeAreaProvider>
        <StatusBar barStyle="dark-content" backgroundColor="#f5f6fa" />
        <LoginScreen onLogin={setUser} />
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <StatusBar barStyle="dark-content" backgroundColor="#f5f6fa" />
        <Tab.Navigator
          screenOptions={({ route }) => ({
            tabBarIcon: ({ color }) => (
              <Text style={{ color, fontSize: 11, fontWeight: '800' }}>{TAB_LABELS[route.name]}</Text>
            ),
            tabBarActiveTintColor: '#0984e3',
            tabBarInactiveTintColor: '#8a97a3',
            tabBarStyle: {
              backgroundColor: '#fff',
              borderTopColor: '#edf0f2',
              height: 62,
              paddingBottom: 8,
              paddingTop: 6,
            },
            headerStyle: { backgroundColor: '#fff' },
            headerTintColor: '#2d3436',
            headerTitleStyle: { fontWeight: '700' },
            headerRight: () => (
              <TouchableOpacity onPress={handleLogout} style={{ marginRight: 14 }}>
                <Text style={{ color: '#d63031', fontSize: 13, fontWeight: '800' }}>Logout</Text>
              </TouchableOpacity>
            ),
          })}
        >
          <Tab.Screen name="Setup" component={SetupScreen} options={{ title: 'Program Gestures' }} />
          <Tab.Screen name="Control" component={ControlScreen} options={{ title: 'Arm Control' }} />
          <Tab.Screen name="Monitor" component={MonitorScreen} options={{ title: 'Live Monitor' }} />
        </Tab.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
