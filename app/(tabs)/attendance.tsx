import React, { useCallback, useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, AppState } from 'react-native';
import { Text, Button, Surface, useTheme, Card, Divider, Chip, Menu, TextInput, Snackbar, HelperText } from 'react-native-paper';
import { useAttendanceStore } from '../../store/attendanceStore';
import { useMachineStore } from '../../store/machineStore';
import { useEmployeeStore } from '../../store/employeeStore';
import { format } from 'date-fns';
import { useFocusEffect } from 'expo-router';
import MachineLogPopup from '../../components/attendance/MachineLogPopup';
import { AttendanceRecord } from '../../types';
import { fetchSites } from '../../services/api';

const ATTENDANCE_STATUS_OPTIONS: AttendanceRecord['status'][] = ['Present', 'Leave', 'Holiday', 'Half Day', 'Week Off', 'No Week Off'];

export default function AttendanceScreen() {
  const theme = useTheme();
  const records = useAttendanceStore(state => state.records);
  const markAttendance = useAttendanceStore(state => state.markAttendance);
  const getPresentCount = useAttendanceStore(state => state.getPresentCount);
  const getStatusCount  = useAttendanceStore(state => state.getStatusCount);
  const refresh = useAttendanceStore(state => state.refresh);
  const marking = useAttendanceStore(state => state.marking);
  const employee = useEmployeeStore(state => state.employee);
  const getMachineForEmployee = useMachineStore(state => state.getMachineForEmployee);
  // Subscribe to logs so the "Today's Machine" chip re-renders when
  // machineStore.logs is hydrated/updated (see dashboard.tsx for details).
  const _machineLogs = useMachineStore(state => state.logs);
  void _machineLogs;
  const [machinePopupVisible, setMachinePopupVisible] = useState(false);
  const [statusMenuVisible, setStatusMenuVisible] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<AttendanceRecord['status']>('Present');
  const [presentExpanded, setPresentExpanded] = useState(false);
  const [absentExpanded,  setAbsentExpanded]  = useState(false);

  // Site / Working Site state
  const [sites, setSites] = useState<string[]>([]);
  const [sitesFetched, setSitesFetched] = useState(false);
  const [sitesFetchFailed, setSitesFetchFailed] = useState(false);
  const [siteMenuVisible, setSiteMenuVisible] = useState(false);
  const [selectedSite, setSelectedSite] = useState<string>('');
  const [workingSite, setWorkingSite] = useState<string>('');

  // Error / feedback UI
  const [errorMsg, setErrorMsg] = useState<string>('');

  const today = new Date();
  const todayStr = format(today, 'yyyy-MM-dd');
  const currentRecord = records[todayStr];

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  // Refresh when the app returns to the foreground (e.g. iOS PWA resume).
  // useFocusEffect does not re-fire when the screen is already focused and
  // the app goes to background then returns, so an explicit AppState
  // listener is required to satisfy the "fetch on resume" requirement.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') refresh();
    });
    return () => sub.remove();
  }, [refresh]);

  // Pre-fill the dropdown with the currently saved status (if any) so the
  // employee can change it; otherwise keep the default 'Present'.
  useEffect(() => {
    const saved = currentRecord?.status;
    if (saved && ATTENDANCE_STATUS_OPTIONS.includes(saved)) {
      setSelectedStatus(saved);
    }
  }, [currentRecord?.status]);

  // Fetch sites on mount. If it fails, fall back to a free-text site input.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const resp = await fetchSites();
        if (cancelled) return;
        setSites(resp.sites);
        setSitesFetched(true);
        setSitesFetchFailed(false);
        if (!selectedSite) {
          const def = resp.default || employee?.site || resp.sites[0] || '';
          if (def) setSelectedSite(def);
        }
      } catch {
        if (cancelled) return;
        setSitesFetched(true);
        setSitesFetchFailed(true);
        if (!selectedSite && employee?.site) setSelectedSite(employee.site);
      }
    })();
    return () => { cancelled = true; };
  // employee.site is used for pre-fill only; refetching when it changes is fine.
  }, [employee?.site]);
  
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

  // Previous cycle = the 26 → 25 window that ended one day before cycleStart.
  let prevCycleStartMonth = cycleStartMonth - 1;
  let prevCycleStartYear  = cycleStartYear;
  if (prevCycleStartMonth < 0) {
    prevCycleStartMonth = 11;
    prevCycleStartYear -= 1;
  }
  const prevCycleStart = new Date(prevCycleStartYear, prevCycleStartMonth, 26);
  const prevCycleEnd   = new Date(cycleStartYear, cycleStartMonth, 25);

  const cycleStartStr = format(cycleStart, 'yyyy-MM-dd');
  const cycleEndStr   = format(cycleEnd,   'yyyy-MM-dd');
  const yesterdayStr  = format(new Date(today.getTime() - 24 * 60 * 60 * 1000), 'yyyy-MM-dd');

  const presentCount = getPresentCount(cycleStartStr, cycleEndStr);

  // Present breakdown — each count is capped at today by getStatusCount internally.
  const presentRaw   = getStatusCount('Present',  cycleStartStr, cycleEndStr);
  const holidayCount = getStatusCount('Holiday',  cycleStartStr, cycleEndStr);
  const weekOffCount = getStatusCount('Week Off', cycleStartStr, cycleEndStr);
  const halfDayCount = getStatusCount('Half Day', cycleStartStr, cycleEndStr);

  // Absent breakdown — capped at yesterday so today's unmarked day isn't counted.
  const absentRaw      = getStatusCount('Absent',      cycleStartStr, yesterdayStr);
  const leaveCount     = getStatusCount('Leave',       cycleStartStr, yesterdayStr);
  const noWeekOffCount = getStatusCount('No Week Off', cycleStartStr, yesterdayStr);
  const absentCount    = absentRaw + leaveCount + noWeekOffCount;

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

  // All dates in the previous cycle (26 → 25), most recent first.
  const prevCycleDates: Date[] = (() => {
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

  const handleMarkAttendance = async () => {
    if (marking) return;
    setErrorMsg('');
    const site = selectedSite.trim();
    const ws = workingSite.trim();
    const result = await markAttendance(
      todayStr,
      selectedStatus,
      site || undefined,
      ws || undefined,
    );
    if (!result.success) {
      setErrorMsg(result.error || 'Failed to mark attendance. Please try again.');
    }
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
              <Button compact mode="text" icon="pencil" onPress={handleOpenMachineLog}>
                {assignedMachine ? 'Change' : 'Log Now'}
              </Button>
            </View>
          </View>
        )}

        {/* When attendance exists (any source) → locked grey indicator.
            Employee cannot change once marked; only admin can via SPIM Suite.
            When no record yet → show dropdown + Mark Attendance button. */}
        <View style={{ width: '100%' }}>
          {currentRecord?.locked ? (
            <View style={styles.recordedBox}>
              <Text variant="bodyMedium" style={{ color: '#9CA3AF' }}>Attendance recorded ✓</Text>
            </View>
          ) : (
            <>
              {!currentRecord && (
                <Text variant="titleMedium" style={{ color: theme.colors.error, marginBottom: 16, textAlign: 'center' }}>
                  Not Marked
                </Text>
              )}
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

              {/* Site: dropdown when fetch succeeded, text input fallback otherwise. */}
              {sitesFetched && !sitesFetchFailed && sites.length > 0 ? (
                <Menu
                  visible={siteMenuVisible}
                  onDismiss={() => setSiteMenuVisible(false)}
                  anchor={
                    <TextInput
                      mode="outlined"
                      value={selectedSite}
                      editable={false}
                      label="Site"
                      style={{ marginTop: 12 }}
                      right={
                        <TextInput.Icon
                          icon={siteMenuVisible ? 'menu-up' : 'menu-down'}
                          onPress={() => setSiteMenuVisible(true)}
                        />
                      }
                      onPressIn={() => setSiteMenuVisible(true)}
                      dense
                    />
                  }
                  contentStyle={{ backgroundColor: theme.colors.surface }}
                >
                  {sites.map(opt => (
                    <Menu.Item
                      key={opt}
                      title={opt}
                      onPress={() => {
                        setSelectedSite(opt);
                        setSiteMenuVisible(false);
                      }}
                    />
                  ))}
                </Menu>
              ) : (
                <TextInput
                  mode="outlined"
                  value={selectedSite}
                  onChangeText={setSelectedSite}
                  label="Site"
                  style={{ marginTop: 12 }}
                  dense
                />
              )}

              <TextInput
                mode="outlined"
                value={workingSite}
                onChangeText={setWorkingSite}
                label="Working Site"
                style={{ marginTop: 12 }}
                dense
              />

              <Button
                mode="contained"
                icon="hand-wave"
                onPress={handleMarkAttendance}
                loading={marking}
                disabled={marking}
                style={{ borderRadius: 8, paddingVertical: 8, marginTop: 16 }}
              >
                {marking ? 'Saving...' : 'Mark Attendance'}
              </Button>
              {errorMsg ? (
                <HelperText type="error" visible style={{ textAlign: 'center' }}>
                  {errorMsg}
                </HelperText>
              ) : null}
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
        <View style={{ flex: 0.48 }}>
          <TouchableOpacity onPress={() => setPresentExpanded(e => !e)} activeOpacity={0.7}>
            <Surface style={[styles.statBox, { flex: 1 }]} elevation={1}>
              <Text variant="displaySmall" style={{ color: theme.colors.primary, fontWeight: 'bold' }}>{presentCount}</Text>
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
              <Text variant="displaySmall" style={{ color: theme.colors.error, fontWeight: 'bold' }}>{absentCount}</Text>
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
            // Sundays render as "Sunday" unless the admin has explicitly
            // overridden the date in SPIM Suite (in which case rec.status
            // wins). Sunday is display-only — never sent to the backend.
            const isSundayCell = !rec && date.getDay() === 0;
            const displayStatus = rec ? rec.status : (isSundayCell ? 'Sunday' : '—');
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
          subtitle={`${format(prevCycleStart, 'dd MMM')} to ${format(prevCycleEnd, 'dd MMM')}`}
          titleStyle={{ color: theme.colors.secondary, fontWeight: 'bold' }}
        />
        <Card.Content>
          {prevCycleDates.map((date, idx) => {
            const dateStr = format(date, 'yyyy-MM-dd');
            const rec = records[dateStr];
            const isSundayCell = !rec && date.getDay() === 0;
            const displayStatus = rec ? rec.status : (isSundayCell ? 'Sunday' : '—');
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

      <MachineLogPopup
        visible={machinePopupVisible}
        onDismiss={() => setMachinePopupVisible(false)}
      />

      <Snackbar
        visible={!!errorMsg}
        onDismiss={() => setErrorMsg('')}
        duration={4000}
        action={{ label: 'Dismiss', onPress: () => setErrorMsg('') }}
      >
        {errorMsg}
      </Snackbar>
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
