import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { List, Text, useTheme } from 'react-native-paper';
import { useRouter, Redirect } from 'expo-router';
import { useEmployeeStore } from '../../store/employeeStore';
import { useAuthStore } from '../../store/authStore';
import { isHrUser } from '../../utils/permissions';

/**
 * HR Panel — occupies the tab-bar slot that "More" occupies for non-HR
 * users. Non-HR users cannot reach this route through the tab bar
 * (href is null in _layout.tsx); if they somehow deep-link here, the
 * <Redirect /> below sends them back to the dashboard.
 */
export default function HrPanelTab() {
  const theme = useTheme();
  const router = useRouter();
  const isAuthenticated = useAuthStore(s => s.isAuthenticated);
  const employee = useEmployeeStore(s => s.employee);

  if (!isAuthenticated || !isHrUser(employee)) {
    return <Redirect href="/(tabs)/dashboard" />;
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.colors.background }}
      contentContainerStyle={styles.container}
    >
      <Text variant="titleLarge" style={styles.heading}>HR Panel</Text>
      <List.Section>
        <List.Item
          title="Attendance Viewer"
          description="View any employee's attendance"
          left={props => <List.Icon {...props} icon="calendar-search" />}
          right={props => <List.Icon {...props} icon="chevron-right" />}
          onPress={() => router.push('/hr/attendance')}
        />
        <List.Item
          title="Income Management"
          description="View, add, edit, delete income"
          left={props => <List.Icon {...props} icon="cash-plus" />}
          right={props => <List.Icon {...props} icon="chevron-right" />}
          onPress={() => router.push('/hr/income')}
        />
        <List.Item
          title="Expense Management"
          description="View, add, edit, delete expenses"
          left={props => <List.Icon {...props} icon="cash-minus" />}
          right={props => <List.Icon {...props} icon="chevron-right" />}
          onPress={() => router.push('/hr/expense')}
        />
        <List.Item
          title="Attendance Reports"
          description="Download PDF / Excel by employee or cycle"
          left={props => <List.Icon {...props} icon="file-chart" />}
          right={props => <List.Icon {...props} icon="chevron-right" />}
          onPress={() => router.push('/hr/reports/attendance')}
        />
      </List.Section>
      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 8 },
  heading: {
    fontWeight: 'bold',
    padding: 12,
  },
});
