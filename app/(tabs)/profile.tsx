import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { Text, TextInput, Button, useTheme, Surface, Avatar, Divider } from 'react-native-paper';
import { useEmployeeStore } from '../../store/employeeStore';
import { useAuthStore } from '../../store/authStore';
import { useRouter } from 'expo-router';

export default function ProfileScreen() {
  const theme = useTheme();
  const employee = useEmployeeStore(state => state.employee);
  const updateProfile = useEmployeeStore(state => state.updateProfile);
  const logout = useAuthStore(state => state.logout);
  const router = useRouter();

  const handleLogout = () => {
    logout();
    router.replace('/(auth)/login');
  };

  const [isEditing, setIsEditing] = useState(false);
  
  // Editable fields state
  const [mobile, setMobile] = useState(employee?.mobile || '');
  const [email, setEmail] = useState(employee?.email || '');
  const [address, setAddress] = useState(employee?.address || '');
  const [emergencyContact, setEmergencyContact] = useState(employee?.emergencyContact || '');
  const [bankDetails, setBankDetails] = useState(employee?.bankDetails || '');

  if (!employee) return null;

  const handleSave = () => {
    updateProfile({
      mobile,
      email,
      address,
      emergencyContact,
      bankDetails
    });
    setIsEditing(false);
  };

  const handleCancel = () => {
    setMobile(employee.mobile);
    setEmail(employee.email);
    setAddress(employee.address);
    setEmergencyContact(employee.emergencyContact);
    setBankDetails(employee.bankDetails);
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
          <Text variant="titleMedium" style={[styles.sectionTitle, { color: theme.colors.secondary }]}>Company Details (Read-only)</Text>
          <Divider style={styles.divider} />
          
          <View style={styles.infoRow}>
            <Text variant="labelLarge" style={styles.label}>Department</Text>
            <Text variant="bodyLarge" style={styles.value}>{employee.department}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text variant="labelLarge" style={styles.label}>Level</Text>
            <Text variant="bodyLarge" style={styles.value}>{employee.level}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text variant="labelLarge" style={styles.label}>PF Number</Text>
            <Text variant="bodyLarge" style={styles.value}>{employee.pfNumber}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text variant="labelLarge" style={styles.label}>Joining Date</Text>
            <Text variant="bodyLarge" style={styles.value}>{employee.joiningDate}</Text>
          </View>
        </Surface>

        <Surface style={styles.section} elevation={1}>
          <View style={styles.sectionHeader}>
            <Text variant="titleMedium" style={[styles.sectionTitle, { color: theme.colors.secondary, marginBottom: 0 }]}>Personal Details</Text>
            {!isEditing && (
              <Button mode="text" onPress={() => setIsEditing(true)}>Edit</Button>
            )}
          </View>
          <Divider style={styles.divider} />

          {isEditing ? (
            <View style={styles.editForm}>
              <TextInput label="Mobile Number" value={mobile} onChangeText={setMobile} mode="outlined" style={styles.input} keyboardType="phone-pad" />
              <TextInput label="Email" value={email} onChangeText={setEmail} mode="outlined" style={styles.input} keyboardType="email-address" />
              <TextInput label="Address" value={address} onChangeText={setAddress} mode="outlined" style={styles.input} multiline />
              <TextInput label="Emergency Contact" value={emergencyContact} onChangeText={setEmergencyContact} mode="outlined" style={styles.input} keyboardType="phone-pad" />
              <TextInput label="Bank Details (Limited)" value={bankDetails} onChangeText={setBankDetails} mode="outlined" style={styles.input} />
              
              <View style={styles.actionRow}>
                <Button mode="outlined" onPress={handleCancel} style={styles.actionBtn}>Cancel</Button>
                <Button mode="contained" onPress={handleSave} style={styles.actionBtn}>Save</Button>
              </View>
            </View>
          ) : (
            <View>
              <View style={styles.infoRow}>
                <Text variant="labelLarge" style={styles.label}>Mobile</Text>
                <Text variant="bodyLarge" style={styles.value}>{employee.mobile}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text variant="labelLarge" style={styles.label}>Email</Text>
                <Text variant="bodyLarge" style={styles.value}>{employee.email}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text variant="labelLarge" style={styles.label}>Address</Text>
                <Text variant="bodyLarge" style={styles.value}>{employee.address}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text variant="labelLarge" style={styles.label}>Emergency</Text>
                <Text variant="bodyLarge" style={styles.value}>{employee.emergencyContact}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text variant="labelLarge" style={styles.label}>Bank Details</Text>
                <Text variant="bodyLarge" style={styles.value}>{employee.bankDetails}</Text>
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
