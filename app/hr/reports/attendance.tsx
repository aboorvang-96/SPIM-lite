import React, { useEffect, useMemo, useState } from 'react';
import { View, StyleSheet, ScrollView, Linking, Alert } from 'react-native';
import {
  Text,
  Card,
  Searchbar,
  Button,
  Divider,
  ActivityIndicator,
  TextInput,
  Menu,
  useTheme,
} from 'react-native-paper';
import { Stack } from 'expo-router';
import { format } from 'date-fns';
import {
  fetchHrEmployees,
  hrAttendanceReportUrl,
  HrEmployee,
} from '../../../services/hrApi';
import { ApiError } from '../../../services/apiClient';

// ---------------------------------------------------------------------------
// Cycle helper — kept in step with app/hr/attendance/index.tsx so the report
// window matches what the viewer displays. Same 26→25 rule as the Suite's
// salary calculator.
// ---------------------------------------------------------------------------

interface Cycle {
  start: Date;
  end: Date;
  startISO: string;
  endISO: string;
  label: string;
}

function cycleForAnchor(anchor: Date): Cycle {
  let startMonth = anchor.getMonth();
  let startYear = anchor.getFullYear();
  if (anchor.getDate() <= 25) {
    startMonth -= 1;
    if (startMonth < 0) {
      startMonth = 11;
      startYear -= 1;
    }
  }
  const start = new Date(startYear, startMonth, 26);
  let endMonth = startMonth + 1;
  let endYear = startYear;
  if (endMonth > 11) {
    endMonth = 0;
    endYear += 1;
  }
  const end = new Date(endYear, endMonth, 25);
  return {
    start,
    end,
    startISO: format(start, 'yyyy-MM-dd'),
    endISO:   format(end,   'yyyy-MM-dd'),
    label:    `${format(start, 'dd MMM yyyy')} – ${format(end, 'dd MMM yyyy')}`,
  };
}

function shiftCycle(cycle: Cycle, months: number): Cycle {
  // Anchor on cycle.start (already day 26 of the cycle's opening month).
  // Using cycle.end (day 25 = last day) meant that setMonth(+months) then
  // setDate(26) landed us on the START of cycle N+shift+1 — so -1 returned
  // the same cycle and +1 skipped one. Anchoring on start keeps day 26 and
  // walks month by month cleanly (day 26 exists in every month, so no
  // month-overflow drift).
  const anchor = new Date(cycle.start);
  anchor.setMonth(anchor.getMonth() + months);
  return cycleForAnchor(anchor);
}

function friendlyError(err: any): string {
  if (err instanceof ApiError) {
    const body = err.body;
    if (body && typeof body === 'object') {
      const serverMsg = (body.error || body.message || body.detail) ?? null;
      if (typeof serverMsg === 'string' && serverMsg.length > 0) return serverMsg;
    }
    if (typeof body === 'string' && body.includes('<html')) {
      return 'This HR endpoint is not available on the connected Suite server. Please deploy the latest Suite backend.';
    }
    if (err.status === 403) return 'You do not have HR permission for this data.';
    if (err.status === 404) return 'Requested data was not found (HTTP 404).';
    if (err.status === 401) return 'Session expired. Please sign in again.';
    if (err.status >= 500) return 'Server error. Please try again in a moment.';
  }
  if (err?.message && typeof err.message === 'string') return err.message;
  return 'Something went wrong. Please try again.';
}

// ---------------------------------------------------------------------------

export default function HrAttendanceReport() {
  const theme = useTheme();

  const [employees, setEmployees] = useState<HrEmployee[]>([]);
  const [empLoading, setEmpLoading] = useState(true);
  const [empError, setEmpError] = useState<string>('');

  const [search, setSearch] = useState('');
  const [empMenuVisible, setEmpMenuVisible] = useState(false);
  // `null` = "All Employees"; otherwise a specific pk.
  const [selectedPk, setSelectedPk] = useState<number | null>(null);

  const [cycle, setCycle] = useState<Cycle>(() => cycleForAnchor(new Date()));

  // Optional custom range — overrides the cycle when both are provided.
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo]     = useState('');

  const [busyFormat, setBusyFormat] = useState<'pdf' | 'xlsx' | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setEmpLoading(true);
      setEmpError('');
      try {
        const list = await fetchHrEmployees();
        if (cancelled) return;
        const sorted = [...list].sort((a, b) =>
          a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }),
        );
        setEmployees(sorted);
      } catch (err: any) {
        if (!cancelled) setEmpError(friendlyError(err));
      } finally {
        if (!cancelled) setEmpLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const filteredEmployees = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return employees;
    return employees.filter(e =>
      e.name.toLowerCase().includes(q) || e.id.toLowerCase().includes(q),
    );
  }, [employees, search]);

  const selectedLabel = useMemo(() => {
    if (selectedPk == null) return 'All Employees';
    const e = employees.find(x => x.pk === selectedPk);
    if (!e) return 'All Employees';
    return `${e.name}${e.id ? ` (${e.id})` : ''}`;
  }, [selectedPk, employees]);

  const effectiveFrom = customFrom.trim() || cycle.startISO;
  const effectiveTo   = customTo.trim()   || cycle.endISO;

  const handleDownload = async (fmt: 'pdf' | 'xlsx') => {
    if (busyFormat) return;
    setBusyFormat(fmt);
    try {
      const url = await hrAttendanceReportUrl({
        employeeId: selectedPk ?? 'all',
        dateFrom:   effectiveFrom,
        dateTo:     effectiveTo,
        format:     fmt,
      });
      await Linking.openURL(url);
    } catch (err: any) {
      Alert.alert(
        'Report unavailable',
        friendlyError(err),
      );
    } finally {
      setBusyFormat(null);
    }
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Stack.Screen options={{ title: 'Attendance Reports' }} />

      <Card style={styles.card} mode="elevated" elevation={1}>
        <Card.Title
          title="Attendance Cycle"
          subtitle={cycle.label}
          titleStyle={{ fontWeight: 'bold', color: theme.colors.secondary }}
        />
        <Card.Content>
          <View style={styles.cycleRow}>
            <Button
              mode="outlined"
              icon="chevron-left"
              compact
              onPress={() => setCycle(shiftCycle(cycle, -1))}
            >
              Previous
            </Button>
            <Button mode="text" compact onPress={() => setCycle(cycleForAnchor(new Date()))}>
              Current
            </Button>
            <Button
              mode="outlined"
              icon="chevron-right"
              contentStyle={{ flexDirection: 'row-reverse' }}
              compact
              onPress={() => setCycle(shiftCycle(cycle, 1))}
            >
              Next
            </Button>
          </View>
        </Card.Content>
      </Card>

      <Card style={styles.card} mode="elevated" elevation={1}>
        <Card.Title
          title="Custom Date Range (optional)"
          subtitle="Overrides the cycle above when both values are set"
          titleStyle={{ fontWeight: 'bold', color: theme.colors.secondary }}
          subtitleNumberOfLines={2}
        />
        <Card.Content>
          <View style={styles.row}>
            <TextInput
              mode="outlined"
              label="Date From (YYYY-MM-DD)"
              value={customFrom}
              onChangeText={setCustomFrom}
              style={styles.rowInput}
              dense
            />
            <TextInput
              mode="outlined"
              label="Date To (YYYY-MM-DD)"
              value={customTo}
              onChangeText={setCustomTo}
              style={styles.rowInput}
              dense
            />
          </View>
          {(customFrom || customTo) ? (
            <Button
              mode="text"
              compact
              onPress={() => { setCustomFrom(''); setCustomTo(''); }}
              style={{ alignSelf: 'flex-end', marginTop: 4 }}
            >
              Clear range
            </Button>
          ) : null}
        </Card.Content>
      </Card>

      <Card style={styles.card} mode="elevated" elevation={1}>
        <Card.Title
          title="Employee"
          subtitle={selectedLabel}
          titleStyle={{ fontWeight: 'bold', color: theme.colors.secondary }}
          subtitleNumberOfLines={2}
        />
        <Card.Content>
          <Menu
            visible={empMenuVisible}
            onDismiss={() => setEmpMenuVisible(false)}
            anchor={
              <Button
                mode="outlined"
                icon="account-search"
                onPress={() => setEmpMenuVisible(true)}
                disabled={empLoading}
              >
                {selectedPk == null ? 'Choose employee (or leave as All)' : 'Change employee'}
              </Button>
            }
            contentStyle={{ backgroundColor: theme.colors.surface }}
          >
            <View style={{ paddingHorizontal: 12, paddingTop: 8, width: 280 }}>
              <Searchbar
                placeholder="Search employees…"
                value={search}
                onChangeText={setSearch}
                style={{ marginBottom: 8 }}
              />
            </View>
            <Menu.Item
              title="All Employees"
              onPress={() => {
                setSelectedPk(null);
                setEmpMenuVisible(false);
              }}
            />
            <Divider />
            {empLoading ? (
              <View style={styles.loadingBox}>
                <ActivityIndicator />
              </View>
            ) : empError ? (
              <Text style={{ color: theme.colors.error, padding: 12 }}>{empError}</Text>
            ) : filteredEmployees.length === 0 ? (
              <Text style={{ padding: 12, color: '#666' }}>No employees match.</Text>
            ) : (
              filteredEmployees.slice(0, 50).map(e => (
                <Menu.Item
                  key={e.pk}
                  title={`${e.name}${e.id ? ` (${e.id})` : ''}`}
                  onPress={() => {
                    setSelectedPk(e.pk);
                    setEmpMenuVisible(false);
                  }}
                />
              ))
            )}
          </Menu>
        </Card.Content>
      </Card>

      <Card style={styles.card} mode="elevated" elevation={1}>
        <Card.Title
          title="Download"
          subtitle={`${selectedLabel} · ${effectiveFrom} → ${effectiveTo}`}
          titleStyle={{ fontWeight: 'bold', color: theme.colors.secondary }}
          subtitleNumberOfLines={2}
        />
        <Card.Content>
          <View style={styles.downloadRow}>
            <Button
              mode="contained"
              icon="file-pdf-box"
              onPress={() => handleDownload('pdf')}
              loading={busyFormat === 'pdf'}
              disabled={busyFormat !== null}
              style={{ flex: 1 }}
            >
              PDF
            </Button>
            <Button
              mode="contained-tonal"
              icon="file-excel-box"
              onPress={() => handleDownload('xlsx')}
              loading={busyFormat === 'xlsx'}
              disabled={busyFormat !== null}
              style={{ flex: 1 }}
            >
              Excel
            </Button>
          </View>
          <Text style={{ color: '#666', marginTop: 8, fontSize: 12 }}>
            The file opens in your device browser and is streamed by the
            SPIM Suite server — no data is generated on-device.
          </Text>
        </Card.Content>
      </Card>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 12 },
  card: { borderRadius: 16, marginBottom: 12 },
  cycleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  rowInput: { flex: 1 },
  loadingBox: { alignItems: 'center', paddingVertical: 16 },
  downloadRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
});
