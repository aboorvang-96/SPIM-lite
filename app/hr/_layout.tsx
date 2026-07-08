import { Redirect, Stack } from 'expo-router';
import { useEmployeeStore } from '../../store/employeeStore';
import { useAuthStore } from '../../store/authStore';
import { isHrUser } from '../../utils/permissions';

/**
 * Route-group guard for every /hr/* screen.
 *
 * Uses expo-router's <Redirect /> so the navigation happens during
 * render — before any HR child screen mounts. Unauthorized users
 * never see the HR page, not even for a frame.
 */
export default function HrLayout() {
  const isAuthenticated = useAuthStore(s => s.isAuthenticated);
  const employee = useEmployeeStore(s => s.employee);
  const allowed = isAuthenticated && isHrUser(employee);

  if (!allowed) {
    return <Redirect href="/(tabs)/dashboard" />;
  }

  return <Stack screenOptions={{ headerShown: true, title: 'HR' }} />;
}
