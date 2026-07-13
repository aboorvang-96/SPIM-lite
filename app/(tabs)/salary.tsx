import React, { useCallback } from 'react';
import { View, StyleSheet, ScrollView, Linking, Alert } from 'react-native';
import { Text, Card, Surface, useTheme, Divider, ProgressBar, Button, ActivityIndicator } from 'react-native-paper';
import { useEmployeeStore } from '../../store/employeeStore';
import { useSalaryStore } from '../../store/salaryStore';
import { useAttendanceStore } from '../../store/attendanceStore';
import { useFocusEffect } from 'expo-router';
import { format } from 'date-fns';
import { formatINR, formatINRPerDay, formatINRProgress, formatCount } from '../../utils/currencyFormatter';
import { payslipDownloadUrl } from '../../services/api';

export default function SalaryScreen() {
  const theme = useTheme();
  const employee = useEmployeeStore(state => state.employee);
  const employeeLoading = useEmployeeStore(state => state.loading);
  const employeeError = useEmployeeStore(state => state.error);
  const refreshEmployee = useEmployeeStore(state => state.refresh);
  const salaryDetails = useSalaryStore(state => state.details);
  const payslips = useSalaryStore(state => state.payslips);
  const currentPayslipId = useSalaryStore(state => state.currentPayslipId);
  const refresh = useSalaryStore(state => state.refresh);
  const getPresentCount = useAttendanceStore(state => state.getPresentCount);
  // Subscribe so display values re-derive when attendance rehydrates on
  // cold start — otherwise fallback presentCount stays at 0 until the
  // next focus-effect refresh.
  const _records = useAttendanceStore(state => state.records);
  void _records;

  // SPIM Suite decides which payslip belongs on this screen — either the
  // current 26→25 cycle's payslip if admin has generated it, or the most
  // recent generated previous one. The mobile client MUST NOT compare
  // months, sort, or otherwise select a payslip itself.
  const currentPayslip =
    currentPayslipId != null
      ? payslips.find(p => p.id === currentPayslipId)
      : undefined;

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  // Backend `/api/mobile/salary/` is the source of truth. For roles where
  // Suite delivers the full payroll snapshot (admin / HR / accounts) every
  // field is used verbatim — the client performs no arithmetic.
  //
  // For regular Employee accounts the endpoint currently returns only
  // basic_salary and net_salary; every derived field (daily_rate,
  // attendance_earnings, paid_days, total_working_days, cycle boundaries,
  // OT / food / PF / advance) is absent. Rendering those as "—" leaves the
  // Salary Breakdown effectively empty, so the client derives fallbacks —
  // used ONLY when Suite is silent — from the values that do arrive plus
  // the local attendance store. Backend field always wins when present.
  const base = salaryDetails.baseMonthly;

  // Fallback cycle boundaries: local 26 → 25 window. Never overrides Suite.
  const now = new Date();
  const fallbackCycleStart = (() => {
    let m = now.getMonth();
    let y = now.getFullYear();
    if (now.getDate() <= 25) {
      m -= 1;
      if (m < 0) { m = 11; y -= 1; }
    }
    return new Date(y, m, 26);
  })();
  const fallbackCycleEnd = (() => {
    let m = fallbackCycleStart.getMonth() + 1;
    let y = fallbackCycleStart.getFullYear();
    if (m > 11) { m = 0; y += 1; }
    return new Date(y, m, 25);
  })();

  const cycleStart = salaryDetails.cycleStart ? new Date(salaryDetails.cycleStart) : fallbackCycleStart;
  const cycleEnd   = salaryDetails.cycleEnd   ? new Date(salaryDetails.cycleEnd)   : fallbackCycleEnd;

  // Total working days denominator: prefer Suite, else use the cycle span
  // (which for a 26 → 25 window is exactly 30 — matching the divisor Suite
  // uses when it computes net_salary for these employees).
  const cycleSpanDays = Math.round(
    (cycleEnd.getTime() - cycleStart.getTime()) / (1000 * 60 * 60 * 24)
  ) + 1;
  const totalWorkingDays = salaryDetails.totalWorkingDays ?? cycleSpanDays;

  // Paid / present days: prefer Suite, else count from the local
  // attendance store within the cycle (excludes Sundays, matches Suite's
  // .exclude(date__week_day=1) rule; see attendanceStore.getPresentCount).
  const cycleStartStr = format(cycleStart, 'yyyy-MM-dd');
  const cycleEndStr   = format(cycleEnd,   'yyyy-MM-dd');
  const localPresent  = getPresentCount(cycleStartStr, cycleEndStr);
  const presentCount = salaryDetails.presentDays ?? localPresent;
  const paidDays     = salaryDetails.paidDays    ?? localPresent;

  // Daily rate & attendance earnings: prefer Suite, else derive from base.
  const dailyRate = salaryDetails.dailyRate
    ?? (base != null && totalWorkingDays ? base / totalWorkingDays : undefined);
  const attendanceEarnings = salaryDetails.attendanceEarnings
    ?? (dailyRate != null ? Math.round(dailyRate * paidDays) : undefined);

  // Net pay: prefer Suite (its number is authoritative). Only fall back to
  // attendance earnings when Suite is silent AND we could derive it.
  const netPay = salaryDetails.netSalary ?? attendanceEarnings;
  const foodAllowance = salaryDetails.foodAllowance;

  // Visual progress bar percentage — UI-only rendering value.
  const progressFraction = (paidDays != null && totalWorkingDays)
    ? Math.min(paidDays / totalWorkingDays, 1)
    : 0;

  if (!employee) {
    // Profile not yet hydrated. Distinguish in-flight refresh (spinner)
    // from a finished-but-failed refresh (error + Retry) so the user
    // never sees an infinite spinner when the backend is unreachable.
    const isFetching = employeeLoading || !employeeError;
    return (
      <ScrollView
        style={[styles.container, { backgroundColor: theme.colors.background }]}
        contentContainerStyle={styles.loadingContent}
      >
        {isFetching ? (
          <>
            <ActivityIndicator animating size="large" />
            <Text variant="bodyMedium" style={{ marginTop: 12, color: '#666' }}>
              Loading salary…
            </Text>
          </>
        ) : (
          <>
            <Text variant="titleMedium" style={{ color: theme.colors.error, textAlign: 'center' }}>
              Could not load salary
            </Text>
            <Text variant="bodySmall" style={{ marginTop: 8, color: '#666', textAlign: 'center' }}>
              {employeeError}
            </Text>
            <Button
              mode="contained"
              icon="refresh"
              style={{ marginTop: 16 }}
              onPress={() => refreshEmployee()}
            >
              Retry
            </Button>
          </>
        )}
      </ScrollView>
    );
  }

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.colors.background }]}>

      <Surface style={styles.summaryCard} elevation={2}>
        <Text variant="titleMedium" style={{ color: theme.colors.onSurfaceVariant, marginBottom: 8 }}>Estimated Net Pay</Text>
        <Text variant="displayMedium" style={{ color: (theme.colors as any).success, fontWeight: 'bold' }}>
          {formatINR(netPay)}
        </Text>
        <Text variant="labelLarge" style={{ marginTop: 8, color: theme.colors.secondary }}>
          {`For ${format(cycleStart, 'MMM')} - ${format(cycleEnd, 'MMM yyyy')} Cycle`}
        </Text>
      </Surface>

      <Text variant="titleLarge" style={[styles.sectionTitle, { color: theme.colors.primary }]}>
        Earnings Progress
      </Text>
      <Surface style={styles.progressCard} elevation={1}>
        <View style={styles.progressRow}>
          <Text variant="bodyMedium">Attendance Earnings</Text>
          <Text variant="bodyLarge" style={{ fontWeight: 'bold' }}>{formatINRProgress(attendanceEarnings, salaryDetails.baseMonthly)}</Text>
        </View>
        <ProgressBar
          progress={progressFraction}
          color={theme.colors.primary}
          style={styles.progressBar}
        />
        <Text variant="labelSmall" style={{ color: '#666', textAlign: 'right' }}>
          {formatCount(presentCount)} / {formatCount(totalWorkingDays)} Days Present
        </Text>
      </Surface>

      <Text variant="titleLarge" style={[styles.sectionTitle, { color: theme.colors.primary, marginTop: 16 }]}>
        Salary Breakdown
      </Text>
      
      <Card style={styles.breakdownCard} mode="elevated" elevation={1}>
        <Card.Content>
          <Text variant="titleMedium" style={{ color: theme.colors.secondary, marginBottom: 12 }}>Employee Info</Text>
          <View style={styles.breakdownRow}>
            <Text variant="bodyMedium" style={styles.label}>Role</Text>
            <Text variant="bodyMedium" style={styles.value}>{employee.role}</Text>
          </View>
          <View style={styles.breakdownRow}>
            <Text variant="bodyMedium" style={styles.label}>Level</Text>
            <Text variant="bodyMedium" style={styles.value}>{employee.level}</Text>
          </View>
          
          <Divider style={styles.divider} />
          
          <Text variant="titleMedium" style={{ color: (theme.colors as any).success, marginBottom: 12 }}>Earnings (+)</Text>
          <View style={styles.breakdownRow}>
            <Text variant="bodyMedium" style={styles.label}>Base Salary</Text>
            <Text variant="bodyMedium" style={styles.value}>{formatINR(salaryDetails.baseMonthly)}</Text>
          </View>
          <View style={styles.breakdownRow}>
            <Text variant="bodyMedium" style={styles.label}>Daily Rate</Text>
            <Text variant="bodyMedium" style={styles.value}>{formatINRPerDay(dailyRate)}</Text>
          </View>
          <View style={styles.breakdownRow}>
            <Text variant="bodyMedium" style={styles.label}>Attendance Earnings ({formatCount(paidDays)}d)</Text>
            <Text variant="bodyMedium" style={styles.value}>{formatINR(attendanceEarnings)}</Text>
          </View>
          <View style={styles.breakdownRow}>
            <Text variant="bodyMedium" style={styles.label}>OT / Extra Allowance</Text>
            <Text variant="bodyMedium" style={styles.value}>{formatINR(salaryDetails.otAllowance)}</Text>
          </View>
          <View style={styles.breakdownRow}>
            <Text variant="bodyMedium" style={styles.label}>Food Allowance</Text>
            <Text variant="bodyMedium" style={styles.value}>
              {formatINR(foodAllowance)}
            </Text>
          </View>

          <Divider style={styles.divider} />
          
          <Text variant="titleMedium" style={{ color: theme.colors.error, marginBottom: 12 }}>Deductions (-)</Text>
          <View style={styles.breakdownRow}>
            <Text variant="bodyMedium" style={styles.label}>PF Amount</Text>
            <Text variant="bodyMedium" style={styles.value}>{formatINR(salaryDetails.pfDeduction)}</Text>
          </View>
          <View style={styles.breakdownRow}>
            <Text variant="bodyMedium" style={styles.label}>Advance Deduction</Text>
            <Text variant="bodyMedium" style={styles.value}>{formatINR(salaryDetails.advanceDeduction)}</Text>
          </View>

          <Divider style={[styles.divider, { backgroundColor: theme.colors.primary, height: 2 }]} />
          
          <View style={styles.breakdownRow}>
            <Text variant="titleMedium" style={[styles.label, { fontWeight: 'bold', color: theme.colors.onSurface }]}>Net Pay</Text>
            <Text variant="titleLarge" style={[styles.value, { color: (theme.colors as any).success, fontWeight: 'bold' }]}>
              {formatINR(netPay)}
            </Text>
          </View>

        </Card.Content>
      </Card>

      <Text variant="titleLarge" style={[styles.sectionTitle, { color: theme.colors.primary, marginTop: 24 }]}>
        Payslips
      </Text>
      <Card style={styles.breakdownCard} mode="elevated" elevation={1}>
        <Card.Content>
          {!currentPayslip ? (
            <Text variant="bodyMedium" style={{ color: '#666', textAlign: 'center', paddingVertical: 12 }}>
              No payslips yet. Once admin generates a payslip in SPIM Suite it will appear here.
            </Text>
          ) : (() => {
            // p.month is "YYYY-MM" from the backend. Split for display —
            // this is UI-only string parsing, not payroll logic.
            const [yr, mo] = (currentPayslip.month || '-').split('-');
            const monthLabel = mo
              ? new Date(Number(yr), Number(mo) - 1, 1).toLocaleString('default', { month: 'long' })
              : '-';
            return (
              <View style={styles.breakdownRow}>
                <View style={{ flex: 1 }}>
                  <Text variant="bodyLarge" style={{ fontWeight: '600' }}>
                    {monthLabel} {yr || ''}
                  </Text>
                  <Text
                    variant="labelSmall"
                    style={{
                      color: currentPayslip.is_generated ? (theme.colors as any).success : theme.colors.error,
                      marginTop: 2,
                    }}
                  >
                    {currentPayslip.is_generated ? 'Generated' : 'Pending'}
                  </Text>
                </View>
                <Text variant="bodyMedium" style={{ marginRight: 12 }}>
                  {formatINR(parseFloat(currentPayslip.net_pay || '0'))}
                </Text>
                <Button
                  mode="text"
                  compact
                  icon={currentPayslip.is_generated ? 'download' : 'lock'}
                  disabled={!currentPayslip.is_generated}
                  onPress={async () => {
                    if (!currentPayslip.is_generated) return;
                    try {
                      const url = await payslipDownloadUrl(currentPayslip.id);
                      await Linking.openURL(url);
                    } catch (e: any) {
                      Alert.alert(
                        'Payslip unavailable',
                        e?.message || 'Could not fetch the payslip. Please try again later.',
                      );
                    }
                  }}
                >
                  {currentPayslip.is_generated ? 'Download' : 'Pending'}
                </Button>
              </View>
            );
          })()}
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
  loadingContent: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
  },
  summaryCard: {
    padding: 32,
    borderRadius: 24,
    alignItems: 'center',
    marginBottom: 24,
    marginTop: 8,
  },
  sectionTitle: {
    fontWeight: 'bold',
    marginBottom: 12,
  },
  progressCard: {
    padding: 20,
    borderRadius: 20,
  },
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  progressBar: {
    height: 8,
    borderRadius: 4,
    marginBottom: 8,
  },
  breakdownCard: {
    borderRadius: 20,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  label: {
    color: '#666',
  },
  value: {
    fontWeight: '600',
  },
  divider: {
    marginVertical: 16,
  }
});
