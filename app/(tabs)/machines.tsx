import React, { useEffect } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import {
  Text,
  Card,
  useTheme,
  Divider,
} from 'react-native-paper';
import { format } from 'date-fns';
import { useMachineStore } from '../../store/machineStore';
import { useEmployeeStore } from '../../store/employeeStore';
import { useAttendanceStore } from '../../store/attendanceStore';

/**
 * Machine Log — VIEW ONLY on SPIM Lite.
 *
 * The mobile app no longer creates, edits, or deletes machine work logs.
 * Employees can only see today's machine assignment (populated from SPIM
 * Suite via machineStore.loadTodayLog). Management roles (admin / HR /
 * manager / accounts) don't reach this screen at all — the tab is hidden
 * in app/(tabs)/_layout.tsx.
 *
 * No writable inputs, no Save / Cancel / Delete buttons, no API writes.
 */
export default function MachinesScreen() {
  const theme = useTheme();
  const employee = useEmployeeStore(state => state.employee);

  const loadMachines = useMachineStore(state => state.loadMachines);
  const loadTodayLog = useMachineStore(state => state.loadTodayLog);
  const getTodayLogForEmployee = useMachineStore(state => state.getTodayLogForEmployee);
  // Subscribe to logs so the card re-renders when machineStore.logs is
  // hydrated by loadTodayLog or updated by an admin-side sync.
  const _machineLogs = useMachineStore(state => state.logs);
  void _machineLogs;

  useEffect(() => {
    loadMachines();
    if (employee) loadTodayLog(employee.id);
  }, [loadMachines, loadTodayLog, employee]);

  const today = new Date();
  const attendanceRecords = useAttendanceStore(state => state.records);
  const todayAttendanceStatus = attendanceRecords[format(today, 'yyyy-MM-dd')]?.status;
  const machineDisplayAllowed =
    !todayAttendanceStatus
    || todayAttendanceStatus === 'Present'
    || todayAttendanceStatus === 'Half Day';
  const todayLog = (employee && machineDisplayAllowed)
    ? getTodayLogForEmployee(employee.id)
    : undefined;

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Text variant="titleLarge" style={[styles.heading, { color: theme.colors.primary }]}>
        Machine Log
      </Text>

      <Card style={styles.noticeCard} mode="elevated" elevation={1}>
        <Card.Content>
          <Text variant="bodyMedium" style={{ color: '#475569', textAlign: 'center' }}>
            View only. Machine work logs are managed from SPIM Suite.
          </Text>
        </Card.Content>
      </Card>

      <Text variant="titleLarge" style={[styles.heading, { color: theme.colors.primary, marginTop: 24 }]}>
        Today's Machine Work
      </Text>

      {todayLog ? (
        <Card style={styles.summaryCard} mode="elevated" elevation={1}>
          <Card.Content>
            <View style={styles.summaryRow}>
              <Text variant="labelMedium" style={styles.summaryLabel}>Machine Number</Text>
              <Text variant="bodyMedium" style={styles.summaryValue}>{todayLog.machineNo}</Text>
            </View>
            <Divider style={styles.summaryDivider} />
            <View style={styles.summaryRow}>
              <Text variant="labelMedium" style={styles.summaryLabel}>Date</Text>
              <Text variant="bodyMedium" style={styles.summaryValue}>
                {format(new Date(todayLog.date), 'dd MMM yyyy')}
              </Text>
            </View>
            <Divider style={styles.summaryDivider} />
            <View style={styles.summaryRow}>
              <Text variant="labelMedium" style={styles.summaryLabel}>Status</Text>
              <Text variant="bodyMedium" style={styles.summaryValue}>{todayLog.status}</Text>
            </View>
            <Divider style={styles.summaryDivider} />
            <View style={styles.summaryRow}>
              <Text variant="labelMedium" style={styles.summaryLabel}>Remarks</Text>
              <Text
                variant="bodyMedium"
                style={[styles.summaryValue, { flex: 1, textAlign: 'right' }]}
                numberOfLines={3}
              >
                {todayLog.remarks ? todayLog.remarks : '—'}
              </Text>
            </View>
          </Card.Content>
        </Card>
      ) : (
        <Card style={styles.summaryCard} mode="elevated" elevation={1}>
          <Card.Content>
            <Text variant="bodyMedium" style={{ color: '#666', textAlign: 'center' }}>
              No machine work logged for today yet.
            </Text>
          </Card.Content>
        </Card>
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  heading: {
    fontWeight: 'bold',
    marginBottom: 12,
    marginTop: 8,
  },
  noticeCard: {
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
  },
  summaryCard: {
    borderRadius: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  summaryLabel: {
    color: '#64748B',
  },
  summaryValue: {
    fontWeight: '600',
    color: '#0F172A',
    maxWidth: '60%',
  },
  summaryDivider: {
    backgroundColor: '#E2E8F0',
  },
});
