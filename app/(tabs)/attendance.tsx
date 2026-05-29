import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Text, Button, Surface, useTheme, Card, Divider, Chip, Menu, TextInput } from 'react-native-paper';
import { useAttendanceStore } from '../../store/attendanceStore';
import { useMachineStore } from '../../store/machineStore';
import { useEmployeeStore } from '../../store/employeeStore';
import { format } from 'date-fns';
import MachineLogPopup from '../../components/attendance/MachineLogPopup';
import { AttendanceRecord } from '../../types';

const ATTENDANCE_STATUS_OPTIONS: AttendanceRecord['status'][] = ['Present', 'Leave', 'Holiday', 'Half Day', 'Week Off', 'No Week Off'];

export default function AttendanceScreen() {
  const theme = useTheme();
  const records = useAttendanceStore(state => state.records);
  const markAttendance = useAttendanceStore(state => state.markAttendance);
  const getPresentCount = useAttendanceStore(state => state.getPresentCount);
  const isAdminLocked  = useAttendanceStore(state => state.isAdminLocked);
  const employee = useEmployeeStore(state => state.employee);
  const getMachineForEmployee = useMachineStore(state => state.getMachineForEmployee);
  // Subscribe to logs so the "Today's Machine" chip re-renders when
  // machineStore.logs is hydrated/updated (see dashboard.tsx for details).
  const _machineLogs = useMachineStore(state => state.logs);
  void _machineLogs;
  const [machinePopupVisible, setMachinePopupVisible] = useState(false);
  const [statusMenuVisible, setStatusMenuVisible] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<AttendanceRecord['status']>('Present');

  const today = new Date();
  const todayStr = format(today, 'yyyy-MM-dd');
  const currentRecord = records[todayStr];
  const adminLocked   = isAdminLocked(todayStr);

  // Pre-fill the dropdown with the currently saved status (if any) so the
  // employee can change it; otherwise keep the default 'Present'.
  useEffect(() => {
    const saved = currentRecord?.status;
    if (saved && ATTENDANCE_STATUS_OPTIONS.includes(saved)) {
      setSelectedStatus(saved);
    }
  }, [currentRecord?.status]);
  
  // Calculate cycle (26th to 25th)
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
  // Roughly days so far in cycle (excluding Sundays realistically, but simplistic for now)
  const totalDaysSoFar = Math.floor((today.getTime() - cycleStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  const absentCount = totalDaysSoFar > 0 ? Math.max(0, totalDaysSoFar - presentCount) : 0;

  // All dates in the current cycle, most recent first, for the history card.
  const cycleDates: Date[] = (() => {
    const dates: Date[] = [];
    let cur = new Date(today.getTime());
    while (cur >= cycleStart) {
      dates.push(new Date(cur));
      cur = new Date(cur.getTime() - 24 * 60 * 60 * 1000);
    }
    return dates;
  })();

  // Business rule: machine work is only displayed when today's attendance
  // status is 'Present' or 'Half Day'. Hide otherwise without deleting the
  // worklog row — switching the status back makes the chip reappear.
  const machineDisplayAllowed =
    !currentRecord?.status
    || currentRecord.status === 'Present'
    || currentRecord.status === 'Half Day';
  const assignedMachine = (employee && machineDisplayAllowed)
    ? getMachineForEmployee(employee.id)
    : null;

  const handleMarkAttendance = () => {
    // Task 6: mark attendance and stop. Machine log is a separate action
    // the employee performs deliberately from the Machines tab.
    markAttendance(todayStr, selectedStatus);
  };

  const handleOpenMachineLog = () => setMachinePopupVisible(true);

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      
      <Surface style={styles.todayCard} elevation={2}>
        <Text variant="titleMedium" style={{ color: theme.colors.secondary, marginBottom: 8 }}>Today's Status</Text>
        <Text variant="headlineSmall" style={{ fontWeight: 'bold', marginBottom: 16 }}>
          {format(today, 'EEEE, dd MMM yyyy')}
        </Text>
        
        {currentRecord && (
          <View style={[styles.statusBox, { marginBottom: 16 }]}>
            <Text variant="headlineSmall" style={{ color: (theme.colors as any).success, fontWeight: 'bold' }}>
              {currentRecord.status}
            </Text>
            {currentRecord.timeIn ? (
              <Text variant="bodyLarge">Time In: {currentRecord.timeIn}</Text>
            ) : null}
            <View style={styles.machineRow}>
              {assignedMachine ? (
                <Chip icon="cog" compact style={styles.machineChip}>{assignedMachine}</Chip>
              ) : (
                <Chip icon="alert-circle-outline" compact style={styles.machineChipMissing}>No machine logged</Chip>
              )}
              <Button compact mode="text" icon="pencil" onPress={handleOpenMachineLog}>
                {assignedMachine ? 'Change' : 'Log Now'}
              </Button>
            </View>
          </View>
        )}

        {/* Edit controls — hidden and replaced with a lock label when today's
            record was set by an admin. Employee records remain editable. */}
        <View style={{ width: '100%' }}>
          {!currentRecord && (
            <Text variant="titleMedium" style={{ color: theme.colors.error, marginBottom: 16, textAlign: 'center' }}>
              Not Marked
            </Text>
          )}
          {adminLocked ? (
            <Chip icon="lock" style={{ alignSelf: 'center', marginTop: 8, backgroundColor: '#F3F4F6' }}>
              Set by Admin
            </Chip>
          ) : (
            <>
              <Menu
                visible={statusMenuVisible}
                onDismiss={() => setStatusMenuVisible(false)}
                anchor={
                  <TextInput
                    mode="outlined"
                    value={selectedStatus}
                    editable={false}
                    label="Status"
                    right={
                      <TextInput.Icon
                        icon={statusMenuVisible ? 'menu-up' : 'menu-down'}
                        onPress={() => setStatusMenuVisible(true)}
                      />
                    }
                    onPressIn={() => setStatusMenuVisible(true)}
                    dense
                  />
                }
                contentStyle={{ backgroundColor: theme.colors.surface }}
              >
                {ATTENDANCE_STATUS_OPTIONS.map(opt => (
                  <Menu.Item
                    key={opt}
                    title={opt}
                    onPress={() => {
                      setSelectedStatus(opt);
                      setStatusMenuVisible(false);
                    }}
                  />
                ))}
              </Menu>
              <Button
                mode="contained"
                icon="hand-wave"
                onPress={handleMarkAttendance}
                style={{ borderRadius: 8, paddingVertical: 8, marginTop: 16 }}
              >
                {currentRecord ? 'Update Status' : 'Mark Attendance'}
              </Button>
            </>
          )}
        </View>
      </Surface>

      <Text variant="titleLarge" style={[styles.sectionTitle, { color: theme.colors.primary }]}>
        Monthly Summary
      </Text>
      <Text variant="bodyMedium" style={{ marginBottom: 16, color: '#666' }}>
        Cycle: {format(cycleStart, 'dd MMM')} to {format(cycleEnd, 'dd MMM')}
      </Text>

      <View style={styles.statsRow}>
        <Surface style={styles.statBox} elevation={1}>
          <Text variant="displaySmall" style={{ color: theme.colors.primary, fontWeight: 'bold' }}>{presentCount}</Text>
          <Text variant="labelLarge">Present</Text>
        </Surface>
        
        <Surface style={styles.statBox} elevation={1}>
          <Text variant="displaySmall" style={{ color: theme.colors.error, fontWeight: 'bold' }}>{absentCount}</Text>
          <Text variant="labelLarge">Absent</Text>
        </Surface>
      </View>

      <Card style={styles.historyCard} mode="elevated" elevation={1}>
        <Card.Title title="Cycle History" titleStyle={{ color: theme.colors.secondary, fontWeight: 'bold' }} />
        <Card.Content>
          {cycleDates.map((date, idx) => {
            const dateStr = format(date, 'yyyy-MM-dd');
            const rec = records[dateStr];
            const statusColor = (rec?.status === 'Present' || rec?.status === 'Week Off')
              ? (theme.colors as any).success
              : (!rec ? '#999' : theme.colors.error);
            return (
              <View key={dateStr}>
                <View style={styles.historyRow}>
                  <Text variant="bodyLarge" style={{ width: 100 }}>{format(date, 'dd MMM')}</Text>
                  <Text variant="bodyLarge" style={{ flex: 1, fontWeight: 'bold', color: statusColor }}>
                    {rec ? rec.status : '—'}
                  </Text>
                  <Text variant="bodyMedium" style={{ color: '#666' }}>{rec?.timeIn || '--:--'}</Text>
                </View>
                {idx < cycleDates.length - 1 && <Divider style={{ marginVertical: 8 }} />}
              </View>
            );
          })}
        </Card.Content>
      </Card>
      
      <View style={{ height: 40 }} />

      <MachineLogPopup
        visible={machinePopupVisible}
        onDismiss={() => setMachinePopupVisible(false)}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  todayCard: {
    padding: 24,
    borderRadius: 24,
    alignItems: 'center',
    marginBottom: 24,
    marginTop: 8,
  },
  statusBox: {
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#F0FDF4',
    borderRadius: 12,
    width: '100%',
  },
  sectionTitle: {
    fontWeight: 'bold',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  statBox: {
    flex: 0.48,
    padding: 24,
    borderRadius: 24,
    alignItems: 'center',
  },
  historyCard: {
    borderRadius: 20,
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  machineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    width: '100%',
  },
  machineChip: {
    backgroundColor: '#DBEAFE',
  },
  machineChipMissing: {
    backgroundColor: '#FEE2E2',
  },
});
