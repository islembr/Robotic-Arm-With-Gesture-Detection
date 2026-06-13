import AsyncStorage from '@react-native-async-storage/async-storage';

import { API_CONFIG } from '../config/arm';

const TOKEN_KEY = 'aidant_mobile_token';
const USER_KEY = 'aidant_mobile_user';

export async function login(email, password) {
  let response;
  try {
    response = await fetch(`${API_CONFIG.baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
  } catch {
    throw new Error(`Cannot reach API at ${API_CONFIG.baseUrl}`);
  }

  if (!response.ok) {
    throw new Error(`Invalid credentials (${response.status})`);
  }

  const result = await response.json();
  if (result.user?.role !== 'user') {
    throw new Error('Only patient accounts can access the mobile app');
  }

  await AsyncStorage.setItem(TOKEN_KEY, result.token);
  await AsyncStorage.setItem(USER_KEY, JSON.stringify(result.user));
  return result.user;
}

export async function getStoredSession() {
  const [token, rawUser] = await Promise.all([
    AsyncStorage.getItem(TOKEN_KEY),
    AsyncStorage.getItem(USER_KEY),
  ]);

  if (!token || !rawUser) return null;

  try {
    const user = JSON.parse(rawUser);
    return user?.role === 'user' ? { token, user } : null;
  } catch {
    return null;
  }
}

export async function logout() {
  await AsyncStorage.multiRemove([TOKEN_KEY, USER_KEY]);
}
