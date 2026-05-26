import React, { useState } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { TextInput, Button, Text, useTheme, Surface } from 'react-native-paper';
import { useAuthStore } from '../../store/authStore';
import { useEmployeeStore } from '../../store/employeeStore';
import { mobileLogin } from '../../services/api';
import { Employee } from '../../types';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function LoginScreen() {
  const [employeeId, setEmployeeId] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const setAuth = useAuthStore(state => state.setAuth);
  const setEmployee = useEmployeeStore(state => state.setEmployee);
  const router = useRouter();

  const handleLogin = async () => {
    setError('');
    const trimmedId = employeeId.trim();
    if (!trimmedId || !password) {
      setError('Please enter Employee ID and Password.');
      return;
    }

    setLoading(true);
    try {
      const resp = await mobileLogin(
        trimmedId,
        password,
        `${Platform.OS} ${Platform.Version}`,
      );

      if (!resp.success || !resp.token || !resp.employee) {
        setError(resp.error || resp.message || 'Invalid credentials.');
        return;
      }

      // Persist token + employee identifier
      await setAuth({
        userId: resp.employee.employee_id || resp.employee.login_id,
        token: resp.token,
        passwordResetRequired: resp.password_reset_required,
      });

      // Map backend employee payload onto the local Employee shape. Fields the
      // backend does not currently return are left blank — they can be filled
      // later from /api/mobile/profile/ which carries bank + PF details.
      const mapped: Employee = {
        id:               resp.employee.employee_id || resp.employee.login_id,
        name:             resp.employee.name || '',
        role:             resp.employee.designation || '',
        level:            '',
        department:       resp.employee.department || '',
        site:             resp.employee.site || resp.employee.location || '',
        mobile:           '',
        email:            '',
        address:          '',
        emergencyContact: '',
        bankDetails:      '',
        pfNumber:         '',
        joiningDate:      '',
      };
      setEmployee(mapped);

      router.replace('/(tabs)/dashboard');
    } catch (e: any) {
      setError(e?.message || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
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
