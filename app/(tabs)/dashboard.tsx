import React, { useEffect } from 'react';
import { View, StyleSheet, ScrollView, Image } from 'react-native';
import { Text, Card, Avatar, useTheme, Surface, IconButton, Chip, ActivityIndicator, Button } from 'react-native-paper';
import { useEmployeeStore } from '../../store/employeeStore';
import { useAttendanceStore } from '../../store/attendanceStore';
import { useSalaryStore } from '../../store/salaryStore';
import { useMachineStore } from '../../store/machineStore';
import { format } from 'date-fns';
import { useRouter } from 'expo-router';
import { formatINR } from '../../utils/currencyFormatter';

export default function DashboardScreen() {
  const theme = useTheme();
  const employee = useEmployeeStore(state => state.employee);
  const employeeLoading = useEmployeeStore(state => state.loading);
  const employeeError = useEmployeeStore(state => state.error);
  const refreshEmployee = useEmployeeStore(state => state.refresh);
  const getPresentCount = useAttendanceStore(state => state.getPresentCount);
  const getNetPay = useSalaryStore(state => state.getNetPay);
  const loadMachines = useMachineStore(state => state.loadMachines);
  const getMachineForEmployee = useMachineStore(state => state.getMachineForEmployee);
  // Subscribe to logs so this component re-renders when machineStore.logs is
  // hydrated by loadTodayLog or mutated by saveLog. Without this, the
  // selector above returns the same action ref forever and the "Today's
  // Machine" chip stays stale until something else triggers a render.
  const _machineLogs = useMachineStore(state => state.logs);
  void _machineLogs;
  const router = useRouter();

  useEffect(() => { loadMachines(); }, [loadMachines]);

  // Mock current cycle dates (26th to 25th)
  const today = new Date();
  let cycleStartMonth = today.getMonth();
  let cycleStartYear = today.getFullYear();
  if (today.getDate() <= 25) {
    cycleStartMonth -= 1;
    if (cycleStartMonth < 0) {
      cycleStartMonth = 11;
      cycleStartYear -= 1;
    }
  }
  const cycleStart = new Date(cycleStartYear, cycleStartMonth, 26);
  
  let cycleEndMonth = cycleStartMonth + 1;
  let cycleEndYear = cycleStartYear;
  if (cycleEndMonth > 11) {
    cycleEndMonth = 0;
    cycleEndYear += 1;
  }
  const cycleEnd = new Date(cycleEndYear, cycleEndMonth, 25);
  
  const presentCount = getPresentCount(format(cycleStart, 'yyyy-MM-dd'), format(cycleEnd, 'yyyy-MM-dd'));
  const netPay = getNetPay(presentCount);
  // Business rule: machine work is only displayed when today's attendance
  // status is 'Present' or 'Half Day'. The worklog row in Supabase is left
  // untouched — this is a UI-only gate so the chip reappears automatically
  // when the employee switches back to a working status.
  const attendanceRecords = useAttendanceStore(state => state.records);
  const todayDateStr = format(today, 'yyyy-MM-dd');
  const todayAttendanceStatus = attendanceRecords[todayDateStr]?.status;
  const machineDisplayAllowed =
    !todayAttendanceStatus
    || todayAttendanceStatus === 'Present'
    || todayAttendanceStatus === 'Half Day';
  const assignedMachine = (employee && machineDisplayAllowed)
    ? getMachineForEmployee(employee.id)
    : null;

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

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.header}>
        <View>
          <Text variant="headlineSmall" style={{ color: theme.colors.primary, fontWeight: 'bold' }}>
            Hello, {employee.name.split(' ')[0]}
          </Text>
          <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
            {employee.role} | {employee.level}
          </Text>
        </View>
        <Avatar.Text size={48} label={employee.name.substring(0,2).toUpperCase()} style={{ backgroundColor: theme.colors.primary }} />
      </View>

      {/* Company details — sourced from the employee's tenant CompanySettings
          row in Supabase. Every field is hidden when empty so the card
          collapses gracefully for tenants that haven't filled it in. */}
      {employee.company && (employee.company.name || employee.company.logoUrl ||
        employee.company.address || employee.company.phone || employee.company.email) ? (
        <Card style={styles.card} mode="elevated" elevation={1}>
          <Card.Content>
            <View style={styles.companyHeader}>
              {employee.company.logoUrl ? (
                <Image
                  source={{ uri: employee.company.logoUrl }}
                  style={styles.companyLogo}
                  resizeMode="contain"
                />
              ) : null}
              <View style={styles.companyHeaderText}>
                {employee.company.name ? (
                  <Text variant="titleMedium" style={{ color: theme.colors.primary, fontWeight: 'bold' }}>
                    {employee.company.name}
                  </Text>
                ) : null}
              </View>
            </View>
            {employee.company.address ? (
              <View style={styles.companyRow}>
                <IconButton icon="map-marker-outline" size={18} iconColor={theme.colors.error} style={styles.companyIcon} />
                <Text variant="bodySmall" style={styles.companyText}>{employee.company.address}</Text>
              </View>
            ) : null}
            {employee.company.phone ? (
              <View style={styles.companyRow}>
                <IconButton icon="phone-outline" size={18} iconColor={theme.colors.primary} style={styles.companyIcon} />
                <Text variant="bodySmall" style={styles.companyText}>{employee.company.phone}</Text>
              </View>
            ) : null}
            {employee.company.email ? (
              <View style={styles.companyRow}>
                <IconButton icon="email-outline" size={18} iconColor={theme.colors.primary} style={styles.companyIcon} />
                <Text variant="bodySmall" style={styles.companyText}>{employee.company.email}</Text>
              </View>
            ) : null}
          </Card.Content>
        </Card>
      ) : null}

      <Card style={styles.card} mode="elevated" elevation={1}>
        <Card.Content>
          <Text variant="titleMedium" style={{ color: theme.colors.secondary, marginBottom: 8 }}>Current Location</Text>
          <View style={styles.row}>
            <IconButton icon="map-marker" size={24} iconColor={theme.colors.error} style={styles.iconMargin} />
            <Text variant="bodyLarge" style={{ flex: 1 }}>{employee.site}</Text>
          </View>
          <View style={styles.machineRow}>
            <View style={styles.row}>
              <IconButton icon="cog-outline" size={20} iconColor={theme.colors.primary} style={styles.iconMargin} />
              <Text variant="bodyMedium" style={{ color: '#666' }}>Today's Machine</Text>
            </View>
            {assignedMachine ? (
              <Chip compact icon="check" style={{ backgroundColor: '#DCFCE7' }}>{assignedMachine}</Chip>
            ) : (
              <Chip compact icon="alert-circle-outline" style={{ backgroundColor: '#FEE2E2' }}>Not Logged</Chip>
            )}
          </View>
        </Card.Content>
      </Card>

      <View style={styles.statsContainer}>
        <Surface style={styles.statBox} elevation={1}>
          <Text variant="titleSmall" style={{ color: theme.colors.onSurfaceVariant }}>Attendance</Text>
          <Text variant="headlineMedium" style={{ color: theme.colors.primary, fontWeight: 'bold' }}>{presentCount}</Text>
          <Text variant="labelSmall">Days Present</Text>
        </Surface>

        <Surface style={styles.statBox} elevation={1}>
          <Text variant="titleSmall" style={{ color: theme.colors.onSurfaceVariant }}>Net Salary</Text>
          <Text variant="headlineMedium" style={{ color: (theme.colors as any).success, fontWeight: 'bold' }}>{formatINR(netPay)}</Text>
          <Text variant="labelSmall">Estimated</Text>
        </Surface>
      </View>

      <Card style={styles.card} mode="elevated" elevation={1}>
        <Card.Title title="Quick Actions" titleStyle={{ color: theme.colors.secondary, fontWeight: 'bold' }} />
        <Card.Content style={styles.quickActions}>
          <View style={styles.actionItem}>
            <IconButton icon="calendar-check" mode="contained" containerColor={theme.colors.primary} iconColor={theme.colors.onPrimary} size={32} onPress={() => router.navigate('/(tabs)/attendance')} />
            <Text variant="labelMedium">Mark Present</Text>
          </View>
          <View style={styles.actionItem}>
            <IconButton icon="cash-multiple" mode="contained" containerColor={theme.colors.secondary} iconColor={theme.colors.onPrimary} size={32} onPress={() => router.navigate('/(tabs)/salary')} />
            <Text variant="labelMedium">Salary</Text>
          </View>
          <View style={styles.actionItem}>
            <IconButton icon="cog-outline" mode="contained" containerColor={theme.colors.secondary} iconColor={theme.colors.onPrimary} size={32} onPress={() => router.navigate('/(tabs)/machines')} />
            <Text variant="labelMedium">Machines</Text>
          </View>
          <View style={styles.actionItem}>
            <IconButton icon="account-cog" mode="contained" containerColor={theme.colors.primary} iconColor={theme.colors.onPrimary} size={32} onPress={() => router.navigate('/(tabs)/profile')} />
            <Text variant="labelMedium">Profile</Text>
          </View>
        </Card.Content>
      </Card>

    </ScrollView>
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
    marginTop: 8,
  },
  card: {
    marginBottom: 20,
    borderRadius: 20,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconMargin: {
    margin: 0,
    marginRight: 8,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  statBox: {
    flex: 1,
    padding: 20,
    borderRadius: 20,
    marginHorizontal: 8,
    alignItems: 'center',
  },
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 8,
  },
  actionItem: {
    alignItems: 'center',
  },
  machineRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
  },
  companyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  companyLogo: {
    width: 44,
    height: 44,
    marginRight: 12,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
  },
  companyHeaderText: {
    flex: 1,
  },
  companyRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 2,
  },
  companyIcon: {
    margin: 0,
    marginRight: 4,
  },
  companyText: {
    flex: 1,
    color: '#475569',
    paddingTop: 6,
  },
});
