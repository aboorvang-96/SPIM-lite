import React, { useCallback, useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, AppState } from 'react-native';
import { Text, Button, Surface, useTheme, Card, Divider, Chip } from 'react-native-paper';
import { useAttendanceStore } from '../../store/attendanceStore';
import { useMachineStore } from '../../store/machineStore';
import { useEmployeeStore } from '../../store/employeeStore';
import { useSalaryStore } from '../../store/salaryStore';
import { format } from 'date-fns';
import { useFocusEffect } from 'expo-router';
import { formatCount, MISSING_VALUE } from '../../utils/currencyFormatter';

export default function AttendanceScreen() {
  const theme = useTheme();
  const records = useAttendanceStore(state => state.records);
  const getStatusCount  = useAttendanceStore(state => state.getStatusCount);
  const refresh = useAttendanceStore(state => state.refresh);
  // Sole source of truth for the "Present" tile — Suite's present_days.
  // Missing → undefined → the count renders as "—".
  const presentDaysBackend = useSalaryStore(state => state.details.presentDays);
  // Sole source of truth for the "Absent" tile — Suite's absent_days.
  // Client no longer aggregates Absent + Leave + No Week Off locally.
  const absentDaysBackend  = useSalaryStore(state => state.details.absentDays);
  // Attendance cycle boundaries come only from Suite's salary payload.
  // The mobile app no longer computes a 26 → 25 window locally.
  const cycleStartISO = useSalaryStore(state => state.details.cycleStart);
  const cycleEndISO   = useSalaryStore(state => state.details.cycleEnd);
  const employee = useEmployeeStore(state => state.employee);
  const getMachineForEmployee = useMachineStore(state => state.getMachineForEmployee);
  // Subscribe to logs so the "Today's Machine" chip re-renders when
  // machineStore.logs is hydrated/updated (see dashboard.tsx for details).
  const _machineLogs = useMachineStore(state => state.logs);
  void _machineLogs;
  const [presentExpanded, setPresentExpanded] = useState(false);
  const [absentExpanded,  setAbsentExpanded]  = useState(false);

  const today = new Date();
  const todayStr = format(today, 'yyyy-MM-dd');
  const currentRecord = records[todayStr];

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  // Refresh when the app returns to the foreground (e.g. iOS PWA resume).
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') refresh();
    });
    return () => sub.remove();
  }, [refresh]);

  // Cycle window is whatever Suite delivered — no local 26 → 25 math.
  // If Suite hasn't shipped the cycle yet, per-cycle counters and history
  // lists render empty; the header shows "—".
  const cycleStart: Date | undefined = cycleStartISO ? new Date(cycleStartISO) : undefined;
  const cycleEnd:   Date | undefined = cycleEndISO   ? new Date(cycleEndISO)   : undefined;

  // Previous cycle = the window ending the day before cycleStart. Length
  // and boundaries are derived by walking backwards from Suite's cycleStart
  // by the same number of days Suite included in the current window — no
  // client 26 → 25 assumption. If either boundary is missing, the previous
  // cycle card renders empty.
  let prevCycleStart: Date | undefined;
  let prevCycleEnd:   Date | undefined;
  if (cycleStart && cycleEnd) {
    const cycleLengthMs = cycleEnd.getTime() - cycleStart.getTime();
    prevCycleEnd   = new Date(cycleStart.getTime() - 24 * 60 * 60 * 1000);
    prevCycleStart = new Date(prevCycleEnd.getTime() - cycleLengthMs);
  }

  const cycleStartStr = cycleStart ? format(cycleStart, 'yyyy-MM-dd') : '';
  const cycleEndStr   = cycleEnd   ? format(cycleEnd,   'yyyy-MM-dd') : '';
  const yesterdayStr  = format(new Date(today.getTime() - 24 * 60 * 60 * 1000), 'yyyy-MM-dd');

  // Backend field only — no client counting, no Sunday logic.
  const presentCount = presentDaysBackend;

  // Present breakdown — each count is capped at today by getStatusCount internally.
  const presentRaw   = getStatusCount('Present',  cycleStartStr, cycleEndStr);
  const holidayCount = getStatusCount('Holiday',  cycleStartStr, cycleEndStr);
  const weekOffCount = getStatusCount('Week Off', cycleStartStr, cycleEndStr);
  const halfDayCount = getStatusCount('Half Day', cycleStartStr, cycleEndStr);

  // Absent tile total = backend absent_days. The three raw filter counts
  // below are still used to populate the expanded breakdown (each row
  // shows the count of one specific backend status label). No client
  // aggregation feeds the displayed "Absent" total anymore.
  const absentCount    = absentDaysBackend;
  const absentRaw      = getStatusCount('Absent',      cycleStartStr, yesterdayStr);
  const leaveCount     = getStatusCount('Leave',       cycleStartStr, yesterdayStr);
  const noWeekOffCount = getStatusCount('No Week Off', cycleStartStr, yesterdayStr);

  // History-list iteration — UI iteration only. Each rendered row still
  // pulls its status from records[dateStr] (Suite). No business value is
  // calculated here.
  const cycleDates: Date[] = (() => {
    if (!cycleStart) return [];
    const dates: Date[] = [];
    let cur = new Date(today.getTime());
    while (cur >= cycleStart) {
      dates.push(new Date(cur));
      cur = new Date(cur.getTime() - 24 * 60 * 60 * 1000);
    }
    return dates;
  })();

  const prevCycleDates: Date[] = (() => {
    if (!prevCycleStart || !prevCycleEnd) return [];
    const dates: Date[] = [];
    let cur = new Date(prevCycleEnd.getTime());
    while (cur >= prevCycleStart) {
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

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.colors.background }]}>

      <Surface style={styles.todayCard} elevation={2}>
        <Text variant="titleMedium" style={{ color: theme.colors.secondary, marginBottom: 8 }}>Today's Status</Text>
        <Text variant="headlineSmall" style={{ fontWeight: 'bold', marginBottom: 16 }}>
          {format(today, 'EEEE, dd MMM yyyy')}
        </Text>

        {currentRecord ? (
          <View style={[styles.statusBox, { marginBottom: 16, backgroundColor: '#F3F4F6' }]}>
            <Text variant="headlineSmall" style={{ color: '#9CA3AF', fontWeight: 'bold' }}>
              {currentRecord.status}
            </Text>
            {currentRecord.timeIn ? (
              <Text variant="bodyLarge" style={{ color: '#9CA3AF' }}>Time In: {currentRecord.timeIn}</Text>
            ) : null}
            {currentRecord.site ? (
              <Text variant="bodyMedium" style={{ color: '#9CA3AF' }}>Site: {currentRecord.site}</Text>
            ) : null}
            {currentRecord.working_site ? (
              <Text variant="bodyMedium" style={{ color: '#9CA3AF' }}>Working Site: {currentRecord.working_site}</Text>
            ) : null}
            <View style={styles.machineRow}>
              {assignedMachine ? (
                <Chip icon="cog" compact style={styles.machineChip}>{assignedMachine}</Chip>
              ) : (
                <Chip icon="alert-circle-outline" compact style={styles.machineChipMissing}>No machine logged</Chip>
              )}
            </View>
          </View>
        ) : (
          <View style={styles.recordedBox}>
            <Text variant="bodyMedium" style={{ color: '#9CA3AF' }}>Not Marked</Text>
          </View>
        )}
      </Surface>

      <Text variant="titleLarge" style={[styles.sectionTitle, { color: theme.colors.primary }]}>
        Monthly Summary
      </Text>
      <Text variant="bodyMedium" style={{ marginBottom: 16, color: '#666' }}>
        Cycle: {cycleStart && cycleEnd
          ? `${format(cycleStart, 'dd MMM')} to ${format(cycleEnd, 'dd MMM')}`
          : MISSING_VALUE}
      </Text>

      <View style={styles.statsRow}>
        <View style={{ flex: 0.48 }}>
          <TouchableOpacity onPress={() => setPresentExpanded(e => !e)} activeOpacity={0.7}>
            <Surface style={[styles.statBox, { flex: 1 }]} elevation={1}>
              <Text variant="displaySmall" style={{ color: theme.colors.primary, fontWeight: 'bold' }}>{formatCount(presentCount)}</Text>
              <Text variant="labelLarge">Present</Text>
              <Text style={{ color: theme.colors.primary, fontSize: 12, marginTop: 4 }}>{presentExpanded ? '▲' : '▼'}</Text>
            </Surface>
          </TouchableOpacity>
          {presentExpanded && (
            <Surface style={styles.breakdownBox} elevation={1}>
              <Text variant="labelSmall" style={styles.breakdownLine}>Present: {presentRaw}d</Text>
              <Text variant="labelSmall" style={styles.breakdownLine}>Holiday: {holidayCount}d</Text>
              <Text variant="labelSmall" style={styles.breakdownLine}>Week Off: {weekOffCount}d</Text>
              <Text variant="labelSmall" style={styles.breakdownLine}>Half Day: {halfDayCount}d</Text>
            </Surface>
          )}
        </View>

        <View style={{ flex: 0.48 }}>
          <TouchableOpacity onPress={() => setAbsentExpanded(e => !e)} activeOpacity={0.7}>
            <Surface style={[styles.statBox, { flex: 1 }]} elevation={1}>
              <Text variant="displaySmall" style={{ color: theme.colors.error, fontWeight: 'bold' }}>{formatCount(absentCount)}</Text>
              <Text variant="labelLarge">Absent</Text>
              <Text style={{ color: theme.colors.error, fontSize: 12, marginTop: 4 }}>{absentExpanded ? '▲' : '▼'}</Text>
            </Surface>
          </TouchableOpacity>
          {absentExpanded && (
            <Surface style={styles.breakdownBox} elevation={1}>
              <Text variant="labelSmall" style={styles.breakdownLine}>Absent: {absentRaw}d</Text>
              <Text variant="labelSmall" style={styles.breakdownLine}>Leave: {leaveCount}d</Text>
              <Text variant="labelSmall" style={styles.breakdownLine}>No Week Off: {noWeekOffCount}d</Text>
            </Surface>
          )}
        </View>
      </View>

      <Card style={styles.historyCard} mode="elevated" elevation={1}>
        <Card.Title title="Cycle History" titleStyle={{ color: theme.colors.secondary, fontWeight: 'bold' }} />
        <Card.Content>
          {cycleDates.map((date, idx) => {
            const dateStr = format(date, 'yyyy-MM-dd');
            const rec = records[dateStr];
            // Status label is whatever SPIM Suite's display_status() sends,
            // including "Sunday". No client-side inference.
            const displayStatus = rec ? rec.status : '—';
            const statusColor = (rec?.status === 'Present' || rec?.status === 'Week Off')
              ? (theme.colors as any).success
              : (!rec ? '#999' : theme.colors.error);
            return (
              <View key={dateStr}>
                <View style={styles.historyRow}>
                  <Text variant="bodyLarge" style={{ width: 100 }}>{format(date, 'dd MMM')}</Text>
                  <Text variant="bodyLarge" style={{ flex: 1, fontWeight: 'bold', color: statusColor }}>
                    {displayStatus}
                  </Text>
                  {rec?.site ? (
                    <Text variant="bodyMedium" style={{ color: '#666', marginRight: 8 }}>{rec.site}</Text>
                  ) : null}
                  <Text variant="bodyMedium" style={{ color: '#666' }}>{rec?.timeIn || '--:--'}</Text>
                </View>
                {idx < cycleDates.length - 1 && <Divider style={{ marginVertical: 8 }} />}
              </View>
            );
          })}
        </Card.Content>
      </Card>

      <Card style={[styles.historyCard, { marginTop: 16 }]} mode="elevated" elevation={1}>
        <Card.Title
          title="Previous Cycle"
          subtitle={prevCycleStart && prevCycleEnd
            ? `${format(prevCycleStart, 'dd MMM')} to ${format(prevCycleEnd, 'dd MMM')}`
            : MISSING_VALUE}
          titleStyle={{ color: theme.colors.secondary, fontWeight: 'bold' }}
        />
        <Card.Content>
          {prevCycleDates.map((date, idx) => {
            const dateStr = format(date, 'yyyy-MM-dd');
            const rec = records[dateStr];
            const displayStatus = rec ? rec.status : '—';
            const statusColor = (rec?.status === 'Present' || rec?.status === 'Week Off')
              ? (theme.colors as any).success
              : (!rec ? '#999' : theme.colors.error);
            return (
              <View key={dateStr}>
                <View style={styles.historyRow}>
                  <Text variant="bodyLarge" style={{ width: 100 }}>{format(date, 'dd MMM')}</Text>
                  <Text variant="bodyLarge" style={{ flex: 1, fontWeight: 'bold', color: statusColor }}>
                    {displayStatus}
                  </Text>
                  {rec?.site ? (
                    <Text variant="bodyMedium" style={{ color: '#666', marginRight: 8 }}>{rec.site}</Text>
                  ) : null}
                  <Text variant="bodyMedium" style={{ color: '#666' }}>{rec?.timeIn || '--:--'}</Text>
                </View>
                {idx < prevCycleDates.length - 1 && <Divider style={{ marginVertical: 8 }} />}
              </View>
            );
          })}
        </Card.Content>
      </Card>

      <View style={{ height: 40 }} />
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
  recordedBox: {
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    width: '100%',
    marginTop: 4,
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
  breakdownBox: {
    borderRadius: 16,
    padding: 12,
    marginTop: 8,
    alignItems: 'flex-start',
    width: '100%',
  },
  breakdownLine: {
    color: '#555',
    marginBottom: 4,
  },
});
