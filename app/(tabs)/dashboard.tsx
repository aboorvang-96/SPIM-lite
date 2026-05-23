import React, { useEffect } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Text, Card, Avatar, useTheme, Surface, IconButton, Chip } from 'react-native-paper';
import { useEmployeeStore } from '../../store/employeeStore';
import { useAttendanceStore } from '../../store/attendanceStore';
import { useSalaryStore } from '../../store/salaryStore';
import { useMachineStore } from '../../store/machineStore';
import { format } from 'date-fns';
import { useRouter } from 'expo-router';

export default function DashboardScreen() {
  const theme = useTheme();
  const employee = useEmployeeStore(state => state.employee);
  const getPresentCount = useAttendanceStore(state => state.getPresentCount);
  const getNetPay = useSalaryStore(state => state.getNetPay);
  const loadMachines = useMachineStore(state => state.loadMachines);
  const getMachineForEmployee = useMachineStore(state => state.getMachineForEmployee);
  const machines = useMachineStore(state => state.machines);
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
  const assignedMachine = employee ? getMachineForEmployee(employee.id) : null;
  const machineList = Object.values(machines);
  const totalTmp = machineList.reduce((s, m) => s + m.tmpCount, 0);

  if (!employee) return null;

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
          <Text variant="headlineMedium" style={{ color: (theme.colors as any).success, fontWeight: 'bold' }}>${netPay.toLocaleString()}</Text>
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

      <Card style={styles.card} mode="elevated" elevation={1}>
        <Card.Title
          title="Machine Workforce"
          titleStyle={{ color: theme.colors.secondary, fontWeight: 'bold' }}
          right={(props) => (
            <IconButton {...props} icon="chevron-right" onPress={() => router.navigate('/(tabs)/machines')} />
          )}
        />
        <Card.Content>
          <View style={styles.row}>
            <View style={[styles.miniStat, { backgroundColor: '#DBEAFE' }]}>
              <Text variant="labelSmall" style={{ color: '#1E3A8A' }}>Machines</Text>
              <Text variant="titleLarge" style={{ fontWeight: 'bold', color: theme.colors.primary }}>{machineList.length}</Text>
            </View>
            <View style={[styles.miniStat, { backgroundColor: '#DCFCE7' }]}>
              <Text variant="labelSmall" style={{ color: '#065F46' }}>Total TMP</Text>
              <Text variant="titleLarge" style={{ fontWeight: 'bold', color: (theme.colors as any).success }}>{totalTmp}</Text>
            </View>
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
  miniStat: {
    flex: 1,
    marginHorizontal: 6,
    padding: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
});
