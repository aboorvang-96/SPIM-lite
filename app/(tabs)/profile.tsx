import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { Text, TextInput, Button, useTheme, Surface, Avatar, Divider, HelperText, ActivityIndicator } from 'react-native-paper';
import { useEmployeeStore } from '../../store/employeeStore';
import { useAuthStore } from '../../store/authStore';
import { fetchBankDetails, updateBankDetails, MobileBankDetails } from '../../services/api';
import { useRouter } from 'expo-router';

export default function ProfileScreen() {
  const theme = useTheme();
  const employee = useEmployeeStore(state => state.employee);
  const employeeLoading = useEmployeeStore(state => state.loading);
  const employeeError = useEmployeeStore(state => state.error);
  const refreshEmployee = useEmployeeStore(state => state.refresh);
  const logout = useAuthStore(state => state.logout);
  const router = useRouter();

  const handleLogout = () => {
    logout();
    router.replace('/(auth)/login');
  };

  // -------------------- Bank Details (Task 3) --------------------
  const [bank, setBank]                 = useState<MobileBankDetails | null>(null);
  const [isEditing, setIsEditing]       = useState(false);
  const [accountHolder, setAccountHolder] = useState('');
  const [bankName, setBankName]         = useState('');
  const [ifsc, setIfsc]                 = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [savingBank, setSavingBank]     = useState(false);
  const [bankError, setBankError]       = useState('');

  // Load bank details on mount and whenever the logged-in employee changes.
  useEffect(() => {
    if (!employee) return;
    (async () => {
      try {
        const b = await fetchBankDetails();
        setBank(b);
        setAccountHolder(b.account_holder || '');
        setBankName(b.bank_name || '');
        setIfsc(b.ifsc_code || '');
        setAccountNumber(b.account_number || '');
      } catch {
        /* server-side scoping means this 401's if token expired; user can re-login */
      }
    })();
  }, [employee?.id]);

  if (!employee) {
    // Profile not yet hydrated. Distinguish in-flight refresh (spinner)
    // from a finished-but-failed refresh (error + Retry) so the user
    // never sees an infinite spinner when the backend is unreachable.
    const isFetching = employeeLoading || !employeeError;
    return (
      <ScrollView
        style={[styles.container, { backgroundColor: theme.colors.background }]}
        contentContainerStyle={styles.loadingContent}
      >
        {isFetching ? (
          <>
            <ActivityIndicator animating size="large" />
            <Text variant="bodyMedium" style={{ marginTop: 12, color: '#666' }}>
              Loading profile…
            </Text>
          </>
        ) : (
          <>
            <Text variant="titleMedium" style={{ color: theme.colors.error, textAlign: 'center' }}>
              Could not load profile
            </Text>
            <Text variant="bodySmall" style={{ marginTop: 8, color: '#666', textAlign: 'center' }}>
              {employeeError}
            </Text>
            <Button
              mode="contained"
              icon="refresh"
              style={{ marginTop: 16 }}
              onPress={() => refreshEmployee()}
            >
              Retry
            </Button>
          </>
        )}
      </ScrollView>
    );
  }

  const handleSaveBank = async () => {
    setBankError('');
    setSavingBank(true);
    try {
      const saved = await updateBankDetails({
        account_holder: accountHolder.trim(),
        bank_name:      bankName.trim(),
        ifsc_code:      ifsc.trim(),
        account_number: accountNumber.trim(),
      });
      setBank(saved);
      setIsEditing(false);
    } catch (e: any) {
      setBankError(e?.message || 'Could not save bank details');
    } finally {
      setSavingBank(false);
    }
  };

  const handleCancelBank = () => {
    setAccountHolder(bank?.account_holder || '');
    setBankName(bank?.bank_name || '');
    setIfsc(bank?.ifsc_code || '');
    setAccountNumber(bank?.account_number || '');
    setBankError('');
    setIsEditing(false);
  };

  return (
    <KeyboardAvoidingView 
      style={{ flex: 1 }} 
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.header}>
          <Avatar.Text size={64} label={employee.name.substring(0,2).toUpperCase()} style={{ backgroundColor: theme.colors.primary, marginBottom: 12 }} />
          <Text variant="headlineSmall" style={{ fontWeight: 'bold', color: theme.colors.primary }}>{employee.name}</Text>
          <Text variant="titleMedium" style={{ color: theme.colors.onSurfaceVariant }}>{employee.id} - {employee.role}</Text>
        </View>

        <Surface style={styles.section} elevation={1}>
          <Text variant="titleMedium" style={[styles.sectionTitle, { color: theme.colors.secondary }]}>Employee Details</Text>
          <Divider style={styles.divider} />

          <View style={styles.infoRow}>
            <Text variant="labelLarge" style={styles.label}>Employee Name</Text>
            <Text variant="bodyLarge" style={styles.value}>{employee.name}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text variant="labelLarge" style={styles.label}>Employee ID</Text>
            <Text variant="bodyLarge" style={styles.value}>{employee.id}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text variant="labelLarge" style={styles.label}>Role</Text>
            <Text variant="bodyLarge" style={styles.value}>{employee.role || '—'}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text variant="labelLarge" style={styles.label}>Level</Text>
            <Text variant="bodyLarge" style={styles.value}>{employee.level || '—'}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text variant="labelLarge" style={styles.label}>Location</Text>
            <Text variant="bodyLarge" style={styles.value}>{employee.location || '—'}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text variant="labelLarge" style={styles.label}>Site</Text>
            <Text variant="bodyLarge" style={styles.value}>{employee.site || '—'}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text variant="labelLarge" style={styles.label}>PF Number</Text>
            <Text variant="bodyLarge" style={styles.value}>{employee.pfNumber || '—'}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text variant="labelLarge" style={styles.label}>Mobile</Text>
            <Text variant="bodyLarge" style={styles.value}>{employee.mobile || '—'}</Text>
          </View>
          {/*
            Bank details intentionally removed here and shown only in the
            dedicated Bank Details section below (Task 3). Salary fields
            live in the Salary tab.
          */}
        </Surface>

        <Surface style={styles.section} elevation={1}>
          <View style={styles.sectionHeader}>
            <Text variant="titleMedium" style={[styles.sectionTitle, { color: theme.colors.secondary, marginBottom: 0 }]}>Bank Details</Text>
            {!isEditing && (
              <Button mode="text" onPress={() => setIsEditing(true)}>Edit</Button>
            )}
          </View>
          <Divider style={styles.divider} />

          {isEditing ? (
            <View style={styles.editForm}>
              <TextInput label="Account Holder Name" value={accountHolder} onChangeText={setAccountHolder} mode="outlined" style={styles.input} />
              <TextInput label="Bank Name" value={bankName} onChangeText={setBankName} mode="outlined" style={styles.input} />
              <TextInput label="IFSC Code" value={ifsc} onChangeText={setIfsc} mode="outlined" style={styles.input} autoCapitalize="characters" />
              <TextInput label="Account Number" value={accountNumber} onChangeText={setAccountNumber} mode="outlined" style={styles.input} keyboardType="number-pad" />
              {bankError ? <HelperText type="error" visible>{bankError}</HelperText> : null}

              <View style={styles.actionRow}>
                <Button mode="outlined" onPress={handleCancelBank} style={styles.actionBtn} disabled={savingBank}>Cancel</Button>
                <Button mode="contained" onPress={handleSaveBank} style={styles.actionBtn} loading={savingBank} disabled={savingBank}>Save</Button>
              </View>
            </View>
          ) : (
            <View>
              <View style={styles.infoRow}>
                <Text variant="labelLarge" style={styles.label}>Account Holder Name</Text>
                <Text variant="bodyLarge" style={styles.value}>{bank?.account_holder || '—'}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text variant="labelLarge" style={styles.label}>Bank Name</Text>
                <Text variant="bodyLarge" style={styles.value}>{bank?.bank_name || '—'}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text variant="labelLarge" style={styles.label}>IFSC Code</Text>
                <Text variant="bodyLarge" style={styles.value}>{bank?.ifsc_code || '—'}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text variant="labelLarge" style={styles.label}>Account Number</Text>
                <Text variant="bodyLarge" style={styles.value}>{bank?.account_number || '—'}</Text>
              </View>
            </View>
          )}
        </Surface>

        <Button 
          mode="contained" 
          buttonColor={theme.colors.error} 
          onPress={handleLogout} 
          style={styles.logoutBtn}
          icon="logout"
        >
          Logout
        </Button>
        <View style={{ height: 40 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  loadingContent: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
    marginTop: 16,
  },
  section: {
    padding: 20,
    borderRadius: 20,
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sectionTitle: {
    fontWeight: 'bold',
    marginBottom: 8,
  },
  divider: {
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  label: {
    color: '#666666',
    flex: 1,
  },
  value: {
    flex: 2,
    textAlign: 'right',
    fontWeight: '500',
  },
  editForm: {
    marginTop: 8,
  },
  input: {
    marginBottom: 16,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  actionBtn: {
    flex: 0.48,
  },
  logoutBtn: {
    marginTop: 8,
    borderRadius: 8,
    paddingVertical: 4,
  }
});
