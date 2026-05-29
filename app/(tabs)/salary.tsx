import React from 'react';
import { View, StyleSheet, ScrollView, Linking, Alert } from 'react-native';
import { Text, Card, Surface, useTheme, Divider, ProgressBar, Button, ActivityIndicator } from 'react-native-paper';
import { useEmployeeStore } from '../../store/employeeStore';
import { useAttendanceStore } from '../../store/attendanceStore';
import { useSalaryStore } from '../../store/salaryStore';
import { format } from 'date-fns';
import { formatINR, formatINRPerDay, formatINRProgress } from '../../utils/currencyFormatter';
import { payslipDownloadUrl } from '../../services/api';

export default function SalaryScreen() {
  const theme = useTheme();
  const employee = useEmployeeStore(state => state.employee);
  const employeeLoading = useEmployeeStore(state => state.loading);
  const employeeError = useEmployeeStore(state => state.error);
  const refreshEmployee = useEmployeeStore(state => state.refresh);
  const getPresentCount = useAttendanceStore(state => state.getPresentCount);
  const salaryDetails = useSalaryStore(state => state.details);
  const payslips = useSalaryStore(state => state.payslips);
  const getAttendanceEarnings = useSalaryStore(state => state.getAttendanceEarnings);
  const getNetPay = useSalaryStore(state => state.getNetPay);

  const today = new Date();
  
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
  const totalWorkingDays = salaryDetails.totalWorkingDays;
  const dailyRate = useSalaryStore.getState().getDailyRate();
  const attendanceEarnings = getAttendanceEarnings(presentCount);
  const netPay = getNetPay(presentCount);

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
          For {format(cycleStart, 'MMM')} - {format(cycleEnd, 'MMM yyyy')} Cycle
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
          progress={Math.min(presentCount / totalWorkingDays, 1)} 
          color={theme.colors.primary} 
          style={styles.progressBar} 
        />
        <Text variant="labelSmall" style={{ color: '#666', textAlign: 'right' }}>
          {presentCount} / {totalWorkingDays} Days Present
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
            <Text variant="bodyMedium" style={styles.value}>{formatINRPerDay(Math.round(dailyRate))}</Text>
          </View>
          <View style={styles.breakdownRow}>
            <Text variant="bodyMedium" style={styles.label}>Attendance Earnings ({presentCount}d)</Text>
            <Text variant="bodyMedium" style={styles.value}>{formatINR(attendanceEarnings)}</Text>
          </View>
          <View style={styles.breakdownRow}>
            <Text variant="bodyMedium" style={styles.label}>OT / Extra Allowance</Text>
            <Text variant="bodyMedium" style={styles.value}>{formatINR(salaryDetails.otAllowance)}</Text>
          </View>
          <View style={styles.breakdownRow}>
            <Text variant="bodyMedium" style={styles.label}>Food Allowance</Text>
            <Text variant="bodyMedium" style={styles.value}>
              {formatINR(parseFloat(payslips[0]?.food_allowance || '0'))}
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
          {payslips.length === 0 ? (
            <Text variant="bodyMedium" style={{ color: '#666', textAlign: 'center', paddingVertical: 12 }}>
              No payslips yet. Once admin generates a payslip in SPIM Suite it will appear here.
            </Text>
          ) : (
            <>
              {payslips.map((p, idx) => {
                // p.month is "YYYY-MM" from the backend. Split for display.
                const [yr, mo] = (p.month || '-').split('-');
                const monthLabel = mo ? new Date(Number(yr), Number(mo) - 1, 1).toLocaleString('default', { month: 'long' }) : '-';
                return (
                  <View key={p.id}>
                    <View style={styles.breakdownRow}>
                      <View style={{ flex: 1 }}>
                        <Text variant="bodyLarge" style={{ fontWeight: '600' }}>
                          {monthLabel} {yr || ''}
                        </Text>
                        <Text variant="labelSmall" style={{ color: p.is_generated ? (theme.colors as any).success : theme.colors.error, marginTop: 2 }}>
                          {p.is_generated ? 'Generated' : 'Pending'}
                        </Text>
                      </View>
                      <Text variant="bodyMedium" style={{ marginRight: 12 }}>
                        {formatINR(parseFloat(p.net_pay || '0'))}
                      </Text>
                      <Button
                        mode="text"
                        compact
                        icon={p.is_generated ? 'download' : 'lock'}
                        disabled={!p.is_generated}
                        onPress={async () => {
                          if (!p.is_generated) return;
                          try {
                            const url = await payslipDownloadUrl(p.id);
                            await Linking.openURL(url);
                          } catch (e: any) {
                            Alert.alert(
                              'Payslip unavailable',
                              e?.message || 'Could not fetch the payslip. Please try again later.',
                            );
                          }
                        }}
                      >
                        {p.is_generated ? 'Download' : 'Pending'}
                      </Button>
                    </View>
                    {idx < payslips.length - 1 && <Divider style={{ marginVertical: 4 }} />}
                  </View>
                );
              })}
            </>
          )}
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
