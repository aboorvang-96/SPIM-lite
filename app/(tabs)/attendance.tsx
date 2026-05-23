import React, { useState } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Text, Button, Surface, useTheme, Card, Divider, Chip } from 'react-native-paper';
import { useAttendanceStore } from '../../store/attendanceStore';
import { useMachineStore } from '../../store/machineStore';
import { useEmployeeStore } from '../../store/employeeStore';
import { format, subDays } from 'date-fns';
import MachineLogPopup from '../../components/attendance/MachineLogPopup';

export default function AttendanceScreen() {
  const theme = useTheme();
  const records = useAttendanceStore(state => state.records);
  const markAttendance = useAttendanceStore(state => state.markAttendance);
  const getPresentCount = useAttendanceStore(state => state.getPresentCount);
  const employee = useEmployeeStore(state => state.employee);
  const getMachineForEmployee = useMachineStore(state => state.getMachineForEmployee);
  const [machinePopupVisible, setMachinePopupVisible] = useState(false);

  const today = new Date();
  const todayStr = format(today, 'yyyy-MM-dd');
  const currentRecord = records[todayStr];
  
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

  const assignedMachine = employee ? getMachineForEmployee(employee.id) : null;

  const handleMarkPresent = () => {
    markAttendance(todayStr, 'Present');
    // Step 3: automatically open Machine Log popup right after success
    setMachinePopupVisible(true);
  };

  const handleOpenMachineLog = () => setMachinePopupVisible(true);

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      
      <Surface style={styles.todayCard} elevation={2}>
        <Text variant="titleMedium" style={{ color: theme.colors.secondary, marginBottom: 8 }}>Today's Status</Text>
        <Text variant="headlineSmall" style={{ fontWeight: 'bold', marginBottom: 16 }}>
          {format(today, 'EEEE, dd MMM yyyy')}
        </Text>
        
        {currentRecord ? (
          <View style={styles.statusBox}>
            <Text variant="headlineSmall" style={{ color: (theme.colors as any).success, fontWeight: 'bold' }}>
              {currentRecord.status}
            </Text>
            <Text variant="bodyLarge">Time In: {currentRecord.timeIn}</Text>
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
        ) : (
          <View>
            <Text variant="titleMedium" style={{ color: theme.colors.error, marginBottom: 16, textAlign: 'center' }}>
              Not Marked
            </Text>
            <Button 
              mode="contained" 
              icon="hand-wave" 
              onPress={handleMarkPresent}
              style={{ borderRadius: 8, paddingVertical: 8 }}
            >
              Mark Present Now
            </Button>
          </View>
        )}
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
        <Card.Title title="Recent History" titleStyle={{ color: theme.colors.secondary, fontWeight: 'bold' }} />
        <Card.Content>
          {[0, 1, 2, 3, 4, 5, 6].map(dayOffset => {
            const date = subDays(today, dayOffset);
            const dateStr = format(date, 'yyyy-MM-dd');
            const rec = records[dateStr];
            const isWeekend = date.getDay() === 0; // Sunday
            
            return (
              <View key={dateStr}>
                <View style={styles.historyRow}>
                  <Text variant="bodyLarge" style={{ width: 100 }}>{format(date, 'dd MMM')}</Text>
                  <Text variant="bodyLarge" style={{ 
                    flex: 1, 
                    fontWeight: 'bold',
                    color: rec?.status === 'Present' ? (theme.colors as any).success : (isWeekend ? '#999' : theme.colors.error)
                  }}>
                    {rec ? rec.status : (isWeekend ? 'Weekend' : 'Absent')}
                  </Text>
                  <Text variant="bodyMedium" style={{ color: '#666' }}>{rec?.timeIn || '--:--'}</Text>
                </View>
                {dayOffset < 6 && <Divider style={{ marginVertical: 8 }} />}
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
