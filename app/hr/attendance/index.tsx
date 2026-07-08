import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import {
  Text,
  Card,
  List,
  Searchbar,
  Button,
  Divider,
  ActivityIndicator,
  useTheme,
} from 'react-native-paper';
import { Stack } from 'expo-router';
import { format } from 'date-fns';
import {
  fetchHrEmployees,
  fetchHrAttendance,
  fetchHrSalary,
  HrEmployee,
  HrAttendanceRecord,
  HrSalary,
} from '../../../services/hrApi';
import { ApiError } from '../../../services/apiClient';

// ---------------------------------------------------------------------------
// 26 → 25 cycle helpers — same rule the existing employee attendance screen
// uses (app/(tabs)/attendance.tsx). Anchor = a date inside the cycle.
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
  const anchor = new Date(cycle.end);
  anchor.setMonth(anchor.getMonth() + months);
  anchor.setDate(26);
  return cycleForAnchor(anchor);
}

// ---------------------------------------------------------------------------
// Error → friendly message. Uses the ApiError.status the shared apiClient
// attaches to every non-2xx response.
// ---------------------------------------------------------------------------

function friendlyError(err: any): string {
  if (err instanceof ApiError) {
    // Prefer the actual server-provided message when present. This avoids
    // masking real errors (e.g. tenant/admin_id issues, missing employee)
    // with a generic client-side hint.
    const body = err.body;
    if (body && typeof body === 'object') {
      const serverMsg =
        (body.error || body.message || body.detail) ?? null;
      if (typeof serverMsg === 'string' && serverMsg.length > 0) return serverMsg;
    }
    // If the body is a raw HTML string, the endpoint URL almost certainly
    // isn't registered on the deployed Suite — surface that specifically
    // instead of a misleading "employee missing" line.
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
// Backend status labels — verbatim from the Suite's display_status() helper.
// The viewer displays and counts these strings AS-IS. No re-derivation,
// no fallback mapping, no client-side calculation.
// ---------------------------------------------------------------------------

const SUMMARY_LABELS = [
  'Present',
  'Absent',
  'Half Day',
  'Leave',
  'Holiday',
  'Sunday',
  'Weekly Off',
  'No Week Off',
] as const;
type SummaryLabel = typeof SUMMARY_LABELS[number];

function summarise(records: HrAttendanceRecord[]): Record<SummaryLabel, number> {
  const out: Record<SummaryLabel, number> = {
    'Present':     0,
    'Absent':      0,
    'Half Day':    0,
    'Leave':       0,
    'Holiday':     0,
    'Sunday':      0,
    'Weekly Off':  0,
    'No Week Off': 0,
  };
  for (const r of records) {
    // Backend status string is the display label — increment the exact
    // bucket if it matches one of the known labels; otherwise skip
    // silently (never invent a bucket).
    if ((SUMMARY_LABELS as readonly string[]).includes(r.status)) {
      out[r.status as SummaryLabel] += 1;
    }
  }
  return out;
}

// ---------------------------------------------------------------------------

export default function HrAttendanceViewer() {
  const theme = useTheme();

  const [employees, setEmployees] = useState<HrEmployee[]>([]);
  const [empLoading, setEmpLoading] = useState(true);
  const [empError, setEmpError] = useState<string>('');

  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<HrEmployee | null>(null);

  const [cycle, setCycle] = useState<Cycle>(() => cycleForAnchor(new Date()));

  const [records, setRecords] = useState<HrAttendanceRecord[]>([]);
  const [attLoading, setAttLoading] = useState(false);
  const [attError, setAttError] = useState<string>('');

  const [salary, setSalary] = useState<HrSalary | null>(null);
  const [salLoading, setSalLoading] = useState(false);
  const [salError, setSalError] = useState<string>('');

  // Load employees once per session — the hrApi module caches the roster
  // so navigating away and back to this screen does NOT refetch. Cycle
  // changes below never touch this effect.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setEmpLoading(true);
      setEmpError('');
      try {
        const list = await fetchHrEmployees();
        if (cancelled) return;
        // Sort by name (case-insensitive). Safe to sort a shared cache copy
        // because fetchHrEmployees returns the same array reference on
        // subsequent calls — sorting it once is idempotent.
        const sorted = [...list].sort((a, b) =>
          a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }),
        );
        setEmployees(sorted);
      } catch (err: any) {
        if (cancelled) return;
        setEmpError(friendlyError(err));
      } finally {
        if (!cancelled) setEmpLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return employees;
    return employees.filter(e =>
      e.name.toLowerCase().includes(q) ||
      e.id.toLowerCase().includes(q),
    );
  }, [employees, search]);

  const summary = useMemo(() => summarise(records), [records]);

  const loadAttendance = useCallback(
    async (emp: HrEmployee, cyc: Cycle) => {
      setAttLoading(true);
      setAttError('');
      try {
        const rows = await fetchHrAttendance(emp.pk, cyc.startISO, cyc.endISO);
        setRecords(rows);
      } catch (err: any) {
        setAttError(friendlyError(err));
        setRecords([]);
      } finally {
        setAttLoading(false);
      }
    },
    [],
  );

  // Salary is anchored on today by the backend (endpoint is NOT cycle-scoped),
  // so this is only called on employee change — never on cycle change.
  const loadSalary = useCallback(async (emp: HrEmployee) => {
    setSalLoading(true);
    setSalError('');
    setSalary(null);
    try {
      const s = await fetchHrSalary(emp.pk);
      setSalary(s);
    } catch (err: any) {
      setSalError(friendlyError(err));
      setSalary(null);
    } finally {
      setSalLoading(false);
    }
  }, []);

  const handleSelect = (emp: HrEmployee) => {
    setSelected(emp);
    loadAttendance(emp, cycle);
    loadSalary(emp);
  };

  // Cycle changes preserve the selected employee and only reload attendance.
  const handlePrevCycle = () => {
    const prev = shiftCycle(cycle, -1);
    setCycle(prev);
    if (selected) loadAttendance(selected, prev);
  };
  const handleNextCycle = () => {
    const next = shiftCycle(cycle, 1);
    setCycle(next);
    if (selected) loadAttendance(selected, next);
  };
  const handleCurrentCycle = () => {
    const current = cycleForAnchor(new Date());
    setCycle(current);
    if (selected) loadAttendance(selected, current);
  };

  const handleClearSelection = () => {
    setSelected(null);
    setRecords([]);
    setAttError('');
    setSalary(null);
    setSalError('');
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Stack.Screen options={{ title: 'Attendance Viewer' }} />

      {/* Cycle selector — always visible so HR can change window before/after picking */}
      <Card style={styles.card} mode="elevated" elevation={1}>
        <Card.Title
          title="Attendance Cycle"
          subtitle={cycle.label}
          titleStyle={{ fontWeight: 'bold', color: theme.colors.secondary }}
        />
        <Card.Content>
          <View style={styles.cycleRow}>
            <Button mode="outlined" icon="chevron-left" compact onPress={handlePrevCycle}>
              Previous
            </Button>
            <Button mode="text" compact onPress={handleCurrentCycle}>
              Current
            </Button>
            <Button
              mode="outlined"
              icon="chevron-right"
              contentStyle={{ flexDirection: 'row-reverse' }}
              compact
              onPress={handleNextCycle}
            >
              Next
            </Button>
          </View>
        </Card.Content>
      </Card>

      {!selected ? (
        <Card style={styles.card} mode="elevated" elevation={1}>
          <Card.Title
            title="Select Employee"
            subtitle="Search by Name or Employee ID"
            titleStyle={{ fontWeight: 'bold', color: theme.colors.secondary }}
          />
          <Card.Content>
            <Searchbar
              placeholder="Search employees…"
              value={search}
              onChangeText={setSearch}
              style={styles.searchbar}
            />

            {empLoading ? (
              <View style={styles.loadingBox}>
                <ActivityIndicator />
                <Text style={{ marginTop: 8, color: '#666' }}>Loading employees…</Text>
              </View>
            ) : empError ? (
              <Text style={{ color: theme.colors.error, marginTop: 12 }}>{empError}</Text>
            ) : filtered.length === 0 ? (
              <Text style={{ color: '#666', marginTop: 12, textAlign: 'center' }}>
                No employees match “{search}”.
              </Text>
            ) : (
              <List.Section>
                {filtered.map((e, idx) => (
                  <View key={e.pk}>
                    <List.Item
                      title={e.name}
                      description={[e.id, e.role, e.dept].filter(Boolean).join(' • ')}
                      left={props => <List.Icon {...props} icon="account" />}
                      right={props => <List.Icon {...props} icon="chevron-right" />}
                      onPress={() => handleSelect(e)}
                    />
                    {idx < filtered.length - 1 && <Divider />}
                  </View>
                ))}
              </List.Section>
            )}
          </Card.Content>
        </Card>
      ) : (
        <>
          {/* Selected employee header */}
          <Card style={styles.card} mode="elevated" elevation={1}>
            <Card.Title
              title={selected.name}
              subtitle={[selected.id, selected.role, selected.dept].filter(Boolean).join(' • ')}
              titleStyle={{ fontWeight: 'bold', color: theme.colors.secondary }}
              right={props => (
                <Button {...props} mode="text" compact onPress={handleClearSelection}>
                  Change
                </Button>
              )}
            />
          </Card>

          {/* Salary Summary — every value comes verbatim from the backend.
              No client-side salary math anywhere in this block. */}
          <Card style={styles.card} mode="elevated" elevation={1}>
            <Card.Title
              title="Salary Summary"
              subtitle={
                salary
                  ? `${salary.salary.cycle_start} – ${salary.salary.cycle_end}`
                  : undefined
              }
              titleStyle={{ fontWeight: 'bold', color: theme.colors.secondary }}
            />
            <Card.Content>
              {salLoading ? (
                <View style={styles.loadingBox}>
                  <ActivityIndicator />
                  <Text style={{ marginTop: 8, color: '#666' }}>Loading salary…</Text>
                </View>
              ) : salError ? (
                <Text style={{ color: theme.colors.error }}>{salError}</Text>
              ) : !salary ? (
                <Text style={{ color: '#666' }}>No salary data available.</Text>
              ) : (
                <View>
                  <View style={styles.salaryRow}>
                    <Text style={styles.salaryLabel}>Base Salary</Text>
                    <Text style={styles.salaryValue}>{salary.salary.basic_salary}</Text>
                  </View>
                  <View style={styles.salaryRow}>
                    <Text style={styles.salaryLabel}>HRA</Text>
                    <Text style={styles.salaryValue}>{salary.salary.hra}</Text>
                  </View>
                  <View style={styles.salaryRow}>
                    <Text style={styles.salaryLabel}>Allowances</Text>
                    <Text style={styles.salaryValue}>{salary.salary.allowances}</Text>
                  </View>
                  <View style={styles.salaryRow}>
                    <Text style={styles.salaryLabel}>Deductions</Text>
                    <Text style={styles.salaryValue}>{salary.salary.deductions}</Text>
                  </View>
                  <Divider style={{ marginVertical: 8 }} />
                  <View style={styles.salaryRow}>
                    <Text style={styles.salaryLabel}>Present Days</Text>
                    <Text style={styles.salaryValue}>{salary.salary.present_days}</Text>
                  </View>
                  <View style={styles.salaryRow}>
                    <Text style={styles.salaryLabel}>Absent Days</Text>
                    <Text style={styles.salaryValue}>{salary.salary.absent_days}</Text>
                  </View>
                  <View style={styles.salaryRow}>
                    <Text style={styles.salaryLabel}>Paid Days</Text>
                    <Text style={styles.salaryValue}>{salary.salary.paid_days}</Text>
                  </View>
                  <Divider style={{ marginVertical: 8 }} />
                  <View style={styles.salaryRow}>
                    <Text style={[styles.salaryLabel, { fontWeight: 'bold' }]}>Net Salary</Text>
                    <Text style={[styles.salaryValue, { fontWeight: 'bold' }]}>
                      {salary.salary.net_salary}
                    </Text>
                  </View>
                </View>
              )}
            </Card.Content>
          </Card>

          {/* Attendance Summary — counts come straight from backend labels */}
          <Card style={styles.card} mode="elevated" elevation={1}>
            <Card.Title
              title="Attendance Summary"
              titleStyle={{ fontWeight: 'bold', color: theme.colors.secondary }}
            />
            <Card.Content>
              {attLoading ? (
                <View style={styles.loadingBox}>
                  <ActivityIndicator />
                  <Text style={{ marginTop: 8, color: '#666' }}>Loading attendance…</Text>
                </View>
              ) : attError ? (
                <Text style={{ color: theme.colors.error }}>{attError}</Text>
              ) : records.length === 0 ? (
                <Text style={{ color: '#666', textAlign: 'center' }}>
                  No attendance records in this cycle.
                </Text>
              ) : (
                <View style={styles.summaryGrid}>
                  {SUMMARY_LABELS.map(label => (
                    <View key={label} style={styles.summaryCell}>
                      <Text variant="titleLarge" style={styles.summaryCount}>
                        {summary[label]}
                      </Text>
                      <Text variant="labelSmall" style={styles.summaryLabel}>
                        {label}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
            </Card.Content>
          </Card>

          {/* Attendance Details — reuses the row style from the employee attendance screen */}
          {!attLoading && !attError && records.length > 0 && (
            <Card style={styles.card} mode="elevated" elevation={1}>
              <Card.Title
                title="Attendance Details"
                subtitle={cycle.label}
                titleStyle={{ fontWeight: 'bold', color: theme.colors.secondary }}
              />
              <Card.Content>
                {records.map((r, idx) => (
                  <View key={`${r.date}-${idx}`}>
                    <View style={styles.historyRow}>
                      <Text variant="bodyLarge" style={{ width: 100 }}>
                        {format(new Date(r.date + 'T00:00:00'), 'dd MMM')}
                      </Text>
                      <Text variant="bodyLarge" style={{ flex: 1, fontWeight: 'bold' }}>
                        {r.status}
                      </Text>
                      {r.site ? (
                        <Text variant="bodyMedium" style={{ color: '#666' }}>{r.site}</Text>
                      ) : null}
                    </View>
                    {idx < records.length - 1 && <Divider style={{ marginVertical: 6 }} />}
                  </View>
                ))}
              </Card.Content>
            </Card>
          )}
        </>
      )}

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
  searchbar: { marginBottom: 8 },
  loadingBox: { alignItems: 'center', paddingVertical: 24 },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  summaryCell: {
    width: '23%',
    alignItems: 'center',
    paddingVertical: 8,
    marginBottom: 8,
  },
  summaryCount: {
    fontWeight: 'bold',
  },
  summaryLabel: {
    color: '#666',
    textAlign: 'center',
    marginTop: 2,
  },
  salaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  salaryLabel: {
    color: '#444',
  },
  salaryValue: {
    color: '#111',
  },
});
