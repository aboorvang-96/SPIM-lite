import { useEffect } from 'react';
import { Tabs } from 'expo-router';
import { useTheme } from 'react-native-paper';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useAuthStore } from '../../store/authStore';
import { useEmployeeStore } from '../../store/employeeStore';
import { useAttendanceStore } from '../../store/attendanceStore';
import { useSalaryStore } from '../../store/salaryStore';
import { useMachineStore } from '../../store/machineStore';
import SpimHeader from '../../components/ui/SpimHeader';

export default function TabsLayout() {
  const theme = useTheme();

  // Once the authenticated tab tree mounts, pull fresh data for every store
  // from the SPIM Suite backend. Each store guards against concurrent fetches
  // so this is safe to call on every mount.
  const isAuthenticated = useAuthStore(s => s.isAuthenticated);
  const refreshEmployee   = useEmployeeStore(s => s.refresh);
  const refreshAttendance = useAttendanceStore(s => s.refresh);
  const refreshSalary     = useSalaryStore(s => s.refresh);
  const loadMachines      = useMachineStore(s => s.loadMachines);
  const loadTodayLog      = useMachineStore(s => s.loadTodayLog);
  // Hydrate today's worklog as soon as the employee id is known. machineStore
  // initialises `logs` to [] on cold start, so without this the "Today's
  // Machine Work" card and dashboard chip would appear empty after a reload
  // even though the row is persisted in projects_worklog.
  const employeeUid = useEmployeeStore(s => s.employee?.id);

  useEffect(() => {
    if (!isAuthenticated) return;
    refreshEmployee();
    loadMachines();
    refreshAttendance().then(() => {
      refreshSalary();
    });
  }, [isAuthenticated, refreshEmployee, refreshAttendance, refreshSalary, loadMachines]);

  useEffect(() => {
    if (!isAuthenticated || !employeeUid) return;
    loadTodayLog(employeeUid);
  }, [isAuthenticated, employeeUid, loadTodayLog]);

  return (
    <Tabs
      screenOptions={{
        // Shared SPIM header for every tab. Left = current page title,
        // center = "SPIM" wordmark (navy). One source of truth — adding a
        // new tab automatically gets the same header.
        header: ({ options }) => <SpimHeader title={(options.title as string) || ''} />,
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.outline,
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="view-dashboard" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="attendance"
        options={{
          title: 'Attendance',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="calendar-check" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="machines"
        options={{
          title: 'Machines',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="cog-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="salary"
        options={{
          title: 'Salary',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="cash-multiple" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="account" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: 'More',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="dots-horizontal" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
