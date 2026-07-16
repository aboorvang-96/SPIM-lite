import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl, Pressable } from 'react-native';
import {
  Text,
  Card,
  Surface,
  ActivityIndicator,
  Icon,
  useTheme,
} from 'react-native-paper';
import { Stack, useRouter } from 'expo-router';
import { format } from 'date-fns';
import {
  fetchHrEmployees,
  fetchHrIncomes,
  fetchHrExpenses,
  fetchHrDashboardToday,
  HrDashboardToday,
} from '../../services/hrApi';
import { ApiError } from '../../services/apiClient';
import { formatINR } from '../../utils/currencyFormatter';

// ---------------------------------------------------------------------------
// 26 → 25 cycle helper — same rule the attendance viewer + report screens
// use. Kept inline here (three-line lift) rather than exporting a shared
// helper as part of Phase 9.1's scope.
// ---------------------------------------------------------------------------

function currentCycle(today: Date): { startISO: string; endISO: string; label: string } {
  let startMonth = today.getMonth();
  let startYear  = today.getFullYear();
  if (today.getDate() <= 25) {
    startMonth -= 1;
    if (startMonth < 0) { startMonth = 11; startYear -= 1; }
  }
  const start = new Date(startYear, startMonth, 26);
  let endMonth = startMonth + 1;
  let endYear  = startYear;
  if (endMonth > 11) { endMonth = 0; endYear += 1; }
  const end = new Date(endYear, endMonth, 25);
  return {
    startISO: format(start, 'yyyy-MM-dd'),
    endISO:   format(end,   'yyyy-MM-dd'),
    label:    `${format(start, 'dd MMM yyyy')} – ${format(end, 'dd MMM yyyy')}`,
  };
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
    if (err.status === 404) return 'Dashboard data was not found (HTTP 404).';
    if (err.status === 401) return 'Session expired. Please sign in again.';
    if (err.status >= 500) return 'Server error. Please try again in a moment.';
  }
  if (err?.message && typeof err.message === 'string') return err.message;
  return 'Something went wrong. Please try again.';
}

function sumAmounts(rows: { amount: string }[]): number {
  let total = 0;
  for (const r of rows) {
    const n = parseFloat(r.amount);
    if (!Number.isNaN(n)) total += n;
  }
  return total;
}

// ---------------------------------------------------------------------------

export default function HrDashboard() {
  const theme  = useTheme();
  const router = useRouter();

  const today  = useMemo(() => new Date(), []);
  const todayISO = useMemo(() => format(today, 'yyyy-MM-dd'), [today]);
  const cycle  = useMemo(() => currentCycle(today), [today]);

  const [loading, setLoading]           = useState(true);
  const [refreshing, setRefreshing]     = useState(false);
  const [error, setError]               = useState<string>('');
  const [totalEmployees, setTotalEmployees] = useState<number | null>(null);
  const [attendance, setAttendance]     = useState<HrDashboardToday | null>(null);
  const [attendanceError, setAttendanceError] = useState<string>('');
  const [todayIncome, setTodayIncome]   = useState<number | null>(null);
  const [todayExpense, setTodayExpense] = useState<number | null>(null);

  const load = useCallback(async () => {
    setError('');
    setAttendanceError('');
    // Run the four calls in parallel — none depend on each other. The
    // attendance summary is a single aggregated endpoint (no fan-out).
    const [empRes, attRes, incRes, expRes] = await Promise.allSettled([
      fetchHrEmployees(),
      fetchHrDashboardToday(),
      fetchHrIncomes({ dateFrom: todayISO, dateTo: todayISO }),
      fetchHrExpenses({ dateFrom: todayISO, dateTo: todayISO }),
    ]);

    if (empRes.status === 'fulfilled') {
      setTotalEmployees(empRes.value.length);
    } else if (attRes.status === 'rejected' && empRes.status === 'rejected') {
      // Both HR calls failed — most likely a permission or connectivity issue.
      setError(friendlyError(empRes.reason));
    }

    if (attRes.status === 'fulfilled') {
      setAttendance(attRes.value);
      // Prefer the server's total_employees when we have it, since it
      // reflects the same tenant-scoped roster the counts were computed against.
      const tot = attRes.value.total_employees;
      if (tot != null && Number.isFinite(tot) && tot > 0) {
        setTotalEmployees(tot);
      }
    } else {
      setAttendance(null);
      setAttendanceError(friendlyError(attRes.reason));
    }

    setTodayIncome(incRes.status === 'fulfilled' ? sumAmounts(incRes.value) : null);
    setTodayExpense(expRes.status === 'fulfilled' ? sumAmounts(expRes.value) : null);
  }, [todayISO]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        await load();
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try { await load(); } finally { setRefreshing(false); }
  }, [load]);

  const netBalance = useMemo(() => {
    if (todayIncome == null || todayExpense == null) return null;
    return todayIncome - todayExpense;
  }, [todayIncome, todayExpense]);

  const showCount = (n: number | null | undefined) =>
    n == null ? '—' : String(n);
  const showMoney = (n: number | null) =>
    n == null ? '—' : formatINR(n);

  if (loading) {
    return (
      <View style={[styles.loadingWrap, { backgroundColor: theme.colors.background }]}>
        <Stack.Screen options={{ title: 'HR Dashboard' }} />
        <ActivityIndicator animating size="large" />
        <Text variant="bodyMedium" style={{ marginTop: 12, color: '#666' }}>
          Loading HR dashboard…
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <Stack.Screen options={{ title: 'HR Dashboard' }} />

      <Card style={styles.card} mode="elevated" elevation={1}>
        <Card.Title
          title="Current Attendance Cycle"
          subtitle={cycle.label}
          titleStyle={{ fontWeight: 'bold', color: theme.colors.secondary }}
          subtitleNumberOfLines={2}
        />
      </Card>

      {error ? (
        <Card style={styles.card} mode="outlined">
          <Card.Content>
            <Text style={{ color: theme.colors.error }}>{error}</Text>
          </Card.Content>
        </Card>
      ) : null}

      {/* Attendance tiles */}
      <View style={styles.tileRow}>
        <StatTile
          label="Total Employees"
          value={showCount(totalEmployees)}
          tint={theme.colors.primary}
        />
        <StatTile
          label="Present Today"
          value={showCount(attendance?.present)}
          tint={(theme.colors as any).success ?? '#16A34A'}
        />
      </View>
      <View style={styles.tileRow}>
        <StatTile
          label="Absent Today"
          value={showCount(attendance?.absent)}
          tint={theme.colors.error}
        />
        <StatTile
          label="Late Today"
          value={attendance?.late == null ? '—' : String(attendance.late)}
          tint={(theme.colors as any).warning ?? '#D97706'}
        />
      </View>

      {attendanceError ? (
        <Text style={{ color: theme.colors.error, marginHorizontal: 4, marginBottom: 12, fontSize: 12 }}>
          {attendanceError}
        </Text>
      ) : null}

      {/* Money tiles */}
      <View style={styles.tileRow}>
        <StatTile
          label="Today's Income"
          value={showMoney(todayIncome)}
          tint={(theme.colors as any).success ?? '#16A34A'}
          small
        />
        <StatTile
          label="Today's Expense"
          value={showMoney(todayExpense)}
          tint={theme.colors.error}
          small
        />
      </View>
      <View style={styles.tileRow}>
        <StatTile
          label="Net Balance (Today)"
          value={showMoney(netBalance)}
          tint={
            netBalance == null
              ? theme.colors.onSurfaceVariant
              : netBalance >= 0
              ? ((theme.colors as any).success ?? '#16A34A')
              : theme.colors.error
          }
          small
          wide
        />
      </View>

      {/* Quick navigation */}
      <Card style={styles.card} mode="elevated" elevation={1}>
        <Card.Title
          title="Quick Access"
          titleStyle={{ fontWeight: 'bold', color: theme.colors.secondary }}
        />
        <Card.Content style={styles.navGrid}>
          <NavCard icon="account-group"        label="Employees"       onPress={() => router.push('/hr/attendance')} />
          <NavCard icon="calendar-check"       label="Attendance"      onPress={() => router.push('/hr/attendance')} />
          <NavCard icon="cash-multiple"        label="Salary Summary"  onPress={() => router.push('/hr/attendance')} />
          <NavCard icon="cash-plus"            label="Income"          onPress={() => router.push('/hr/income')} />
          <NavCard icon="cash-minus"           label="Expense"         onPress={() => router.push('/hr/expense')} />
        </Card.Content>
      </Card>

      <View style={{ height: 24 }} />
    </ScrollView>
  );
}

// ---------------------------------------------------------------------------

function StatTile({
  label, value, tint, small, wide,
}: {
  label: string;
  value: string;
  tint: string;
  small?: boolean;
  wide?: boolean;
}) {
  return (
    <Surface style={[styles.tile, wide && styles.tileWide]} elevation={1}>
      <Text variant="labelSmall" style={styles.tileLabel}>{label}</Text>
      <Text
        style={[
          small ? styles.tileValueSmall : styles.tileValue,
          { color: tint },
        ]}
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {value}
      </Text>
    </Surface>
  );
}

function NavCard({
  icon, label, onPress,
}: {
  icon: string;
  label: string;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable onPress={onPress} style={styles.navItem} android_ripple={{ color: '#E5E7EB' }}>
      <Surface style={styles.navSurface} elevation={1}>
        <Icon source={icon} size={28} color={theme.colors.primary} />
        <Text variant="labelMedium" style={{ marginTop: 6, textAlign: 'center' }}>
          {label}
        </Text>
      </Surface>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container:  { flex: 1, padding: 12 },
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card:       { borderRadius: 16, marginBottom: 12 },
  tileRow:    { flexDirection: 'row', gap: 8, marginBottom: 8 },
  tile: {
    flex: 1,
    padding: 14,
    borderRadius: 16,
    alignItems: 'flex-start',
    minHeight: 78,
    justifyContent: 'space-between',
  },
  tileWide: { flex: 1 },
  tileLabel: { color: '#666' },
  tileValue: { fontSize: 28, fontWeight: 'bold', marginTop: 4 },
  tileValueSmall: { fontSize: 20, fontWeight: 'bold', marginTop: 4 },
  navGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  navItem: {
    width: '31%',
    marginBottom: 8,
    borderRadius: 16,
    overflow: 'hidden',
  },
  navSurface: {
    padding: 12,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 88,
  },
});
