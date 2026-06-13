import React, { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { login } from '../services/auth';

export default function LoginScreen({ onLogin }) {
  const [email, setEmail] = useState('patient@demo.com');
  const [password, setPassword] = useState('123456');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setLoading(true);
    setError('');

    try {
      const user = await login(email, password);
      onLogin(user);
    } catch (err) {
      setError(err.message || 'Login failed. Use the demo patient account.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Arm Control</Text>
        <Text style={styles.subtitle}>Patient demo access</Text>

        <Text style={styles.label}>Email</Text>
        <TextInput
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          style={styles.input}
          placeholder="patient@demo.com"
        />

        <Text style={styles.label}>Password</Text>
        <TextInput
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          style={styles.input}
          placeholder="123456"
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <TouchableOpacity disabled={loading} style={[styles.button, loading && styles.buttonDisabled]} onPress={submit}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Login</Text>}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', backgroundColor: '#f5f6fa', padding: 20 },
  card: { backgroundColor: '#fff', borderRadius: 8, padding: 22, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 10, elevation: 4 },
  title: { color: '#2d3436', fontSize: 28, fontWeight: '800', textAlign: 'center' },
  subtitle: { color: '#636e72', fontSize: 14, fontWeight: '600', textAlign: 'center', marginTop: 6, marginBottom: 24 },
  label: { color: '#2d3436', fontSize: 13, fontWeight: '700', marginBottom: 7 },
  input: { height: 46, borderWidth: 1, borderColor: '#dfe6e9', borderRadius: 8, paddingHorizontal: 12, marginBottom: 14, color: '#2d3436' },
  error: { color: '#d63031', fontSize: 13, fontWeight: '700', marginBottom: 14 },
  button: { height: 48, borderRadius: 8, backgroundColor: '#0984e3', alignItems: 'center', justifyContent: 'center' },
  buttonDisabled: { opacity: 0.7 },
  buttonText: { color: '#fff', fontSize: 15, fontWeight: '800' },
});
