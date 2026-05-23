import React, { useState } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { TextInput, Button, Text, useTheme, Surface } from 'react-native-paper';
import { useAuthStore } from '../../store/authStore';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function LoginScreen() {
  const [employeeId, setEmployeeId] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const login = useAuthStore(state => state.login);
  const router = useRouter();

  const handleLogin = () => {
    setError('');
    if (!employeeId || !password) {
      setError('Please enter Employee ID and Password.');
      return;
    }
    
    setLoading(true);
    // Mock API call delay
    setTimeout(() => {
      setLoading(false);
      // Mock validation
      if (employeeId === 'EMP1024' && password === 'password123') {
        login(employeeId);
        router.replace('/(tabs)/dashboard');
      } else {
        setError('Invalid credentials. Try EMP1024 / password123');
      }
    }, 800);
  };

  return (
    <KeyboardAvoidingView 
      style={[styles.container, { backgroundColor: theme.colors.primary }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[styles.inner, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Text variant="displaySmall" style={{ color: theme.colors.onPrimary, fontWeight: 'bold' }}>SPIM Lite</Text>
          <Text variant="titleMedium" style={{ color: theme.colors.onPrimary, opacity: 0.8 }}>Employee Portal</Text>
        </View>

        <Surface style={styles.formContainer} elevation={4}>
          <Text variant="headlineSmall" style={[styles.title, { color: theme.colors.primary }]}>Welcome Back</Text>
          
          {error ? <Text style={[styles.errorText, { color: theme.colors.error }]}>{error}</Text> : null}

          <TextInput
            label="Employee ID"
            value={employeeId}
            onChangeText={setEmployeeId}
            mode="outlined"
            style={styles.input}
            autoCapitalize="characters"
            left={<TextInput.Icon icon="account" />}
          />
          
          <TextInput
            label="Password"
            value={password}
            onChangeText={setPassword}
            mode="outlined"
            secureTextEntry
            style={styles.input}
            left={<TextInput.Icon icon="lock" />}
          />

          <Button 
            mode="contained" 
            onPress={handleLogin} 
            loading={loading}
            style={styles.button}
            contentStyle={styles.buttonContent}
          >
            Login
          </Button>
        </Surface>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  inner: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 48,
  },
  formContainer: {
    padding: 32,
    borderRadius: 24, // Modern large border radius
  },
  title: {
    fontWeight: 'bold',
    marginBottom: 24,
    textAlign: 'center',
  },
  input: {
    marginBottom: 16,
  },
  button: {
    marginTop: 8,
    borderRadius: 8,
  },
  buttonContent: {
    paddingVertical: 8,
  },
  errorText: {
    marginBottom: 16,
    textAlign: 'center',
  }
});
