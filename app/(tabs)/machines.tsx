import React, { useEffect, useMemo } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Text, Surface, Card, useTheme, Divider, Chip, IconButton } from 'react-native-paper';
import { useMachineStore } from '../../store/machineStore';
import { useEmployeeStore } from '../../store/employeeStore';
import { format } from 'date-fns';

export default function MachinesScreen() {
  const theme = useTheme();
  const machines = useMachineStore(state => state.machines);
  const logs = useMachineStore(state => state.logs);
  const loadMachines = useMachineStore(state => state.loadMachines);
  const employee = useEmployeeStore(state => state.employee);

  useEffect(() => { loadMachines(); }, [loadMachines]);

  const summary = useMemo(() => Object.values(machines), [machines]);
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const myLog = employee ? logs.find(l => l.employeeId === employee.id && l.date === todayStr) : undefined;
  const totalAssigned = summary.reduce((s, m) => s + m.tmpCount, 0);

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.colors.background }]}>

      <Surface style={styles.headerCard} elevation={2}>
        <Text variant="titleMedium" style={{ color: theme.colors.secondary, marginBottom: 6 }}>Machine Work Summary</Text>
        <Text variant="headlineSmall" style={{ fontWeight: 'bold' }}>{summary.length} Machines</Text>
        <Text variant="bodyMedium" style={{ color: '#666', marginTop: 4 }}>
          {totalAssigned} workers assigned today
        </Text>
      </Surface>

      {myLog && (
        <Card style={styles.myLogCard} mode="elevated" elevation={1}>
          <Card.Content>
            <View style={styles.rowBetween}>
              <Text variant="titleMedium" style={{ color: theme.colors.primary, fontWeight: 'bold' }}>
                Your Log Today
              </Text>
              <Chip icon="check" compact style={{ backgroundColor: '#DCFCE7' }}>{myLog.machineNumber}</Chip>
            </View>
            <Text variant="bodySmall" style={{ color: '#666', marginTop: 6 }}>
              {format(new Date(myLog.date), 'dd MMM yyyy')} at {myLog.time} • {myLog.location}
            </Text>
          </Card.Content>
        </Card>
      )}

      <Text variant="titleLarge" style={[styles.sectionTitle, { color: theme.colors.primary }]}>
        Machines
      </Text>

      {summary.length === 0 ? (
        <Card style={styles.card} mode="elevated" elevation={1}>
          <Card.Content>
            <Text variant="bodyMedium" style={{ color: '#666', textAlign: 'center' }}>
              No machines loaded yet.
            </Text>
          </Card.Content>
        </Card>
      ) : summary.map(m => (
        <Card key={m.id} style={styles.card} mode="elevated" elevation={1}>
          <Card.Content>
            <View style={styles.rowBetween}>
              <View style={{ flexShrink: 1 }}>
                <Text variant="titleMedium" style={{ fontWeight: 'bold' }}>{m.machineNumber}</Text>
                <Text variant="bodySmall" style={{ color: '#666' }} numberOfLines={1}>{m.location}</Text>
              </View>
              <View style={styles.tmpBox}>
                <Text variant="labelSmall" style={{ color: theme.colors.secondary }}>TMP</Text>
                <Text variant="headlineSmall" style={{ color: theme.colors.primary, fontWeight: 'bold' }}>{m.tmpCount}</Text>
              </View>
            </View>

            <Divider style={{ marginVertical: 10 }} />

            <View style={styles.miniRow}>
              <View style={styles.miniBox}>
                <Text variant="labelSmall" style={{ color: '#666' }}>Assigned</Text>
                <Text variant="titleMedium" style={{ fontWeight: '600' }}>{m.assignedEmployees.length}</Text>
              </View>
              <View style={styles.miniBox}>
                <Text variant="labelSmall" style={{ color: '#666' }}>Attendance</Text>
                <Text variant="titleMedium" style={{ fontWeight: '600' }}>{m.attendanceCount}</Text>
              </View>
              <View style={styles.miniBox}>
                <Text variant="labelSmall" style={{ color: '#666' }}>Date</Text>
                <Text variant="bodyMedium" style={{ fontWeight: '600' }}>{format(new Date(), 'dd MMM')}</Text>
              </View>
            </View>
          </Card.Content>
        </Card>
      ))}

      <Text variant="titleLarge" style={[styles.sectionTitle, { color: theme.colors.primary, marginTop: 8 }]}>
        Recent Logs
      </Text>

      {logs.length === 0 ? (
        <Card style={styles.card} mode="elevated" elevation={1}>
          <Card.Content>
            <Text variant="bodyMedium" style={{ color: '#666', textAlign: 'center' }}>
              No machine logs yet. Mark attendance to start logging.
            </Text>
          </Card.Content>
        </Card>
      ) : (
        <Card style={styles.card} mode="elevated" elevation={1}>
          <Card.Content>
            {logs.slice(0, 8).map((log, idx) => (
              <View key={log.id}>
                <View style={styles.logRow}>
                  <View style={{ flex: 1 }}>
                    <Text variant="bodyMedium" style={{ fontWeight: '600' }}>{log.employeeName}</Text>
                    <Text variant="labelSmall" style={{ color: '#666' }}>{log.employeeId} • {format(new Date(log.date), 'dd MMM')} {log.time}</Text>
                  </View>
                  <Chip compact style={styles.logChip}>{log.machineNumber}</Chip>
                </View>
                {idx < Math.min(7, logs.length - 1) && <Divider style={{ marginVertical: 8 }} />}
              </View>
            ))}
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
  headerCard: {
    padding: 20,
    borderRadius: 20,
    marginBottom: 16,
    marginTop: 8,
  },
  myLogCard: {
    borderRadius: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontWeight: 'bold',
    marginBottom: 12,
  },
  card: {
    borderRadius: 16,
    marginBottom: 12,
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  tmpBox: {
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: '#DBEAFE',
    minWidth: 64,
  },
  miniRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  miniBox: {
    alignItems: 'center',
    flex: 1,
  },
  logRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  logChip: {
    backgroundColor: '#DBEAFE',
  },
});
