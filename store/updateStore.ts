import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  AUTH_TOKEN_KEY,
  setForceUpdateHandler,
} from '../services/apiClient';
import {
  clearHrEmployeeCache,
  clearHrSalaryCache,
  clearHrIncomeCategoryCache,
  clearHrExpenseCategoryCache,
} from '../services/hrApi';
import { useAuthStore } from './authStore';
import { useEmployeeStore } from './employeeStore';
import { useAttendanceStore } from './attendanceStore';
import { useSalaryStore } from './salaryStore';

/**
 * Global "app version no longer supported" flag.
 *
 * Set exactly once — by the transport layer's HTTP 426 handler — for the
 * remainder of the process's lifetime. Reading this flag is how the root
 * layout replaces the entire navigation tree with the Update Required
 * screen, which is the only way the message satisfies the "no bypass"
 * requirement (blocking at a screen level would leave routing gaps that
 * pending navigations could slip through).
 *
 * Not persisted: on the next launch the first API call will re-trigger
 * the gate if the backend still rejects this build.
 */
interface UpdateState {
  updateRequired: boolean;
}

export const useUpdateStore = create<UpdateState>(() => ({
  updateRequired: false,
}));

/**
 * Wipe every module-level cache. Mirrors authStore's clearHrCaches — we
 * need the equivalent teardown here because the auth store's logout()
 * cannot be called from a synchronous handler without importing it lazily
 * (which we do below), and we still want the caches gone before the
 * update screen mounts.
 */
function clearAllCaches(): void {
  clearHrEmployeeCache();
  clearHrSalaryCache();
  clearHrIncomeCategoryCache();
  clearHrExpenseCategoryCache();
}

// Install the 426 handler at module load. Imported by the root layout, so
// the wiring is in place before any API call fires.
setForceUpdateHandler(async () => {
  // Idempotent by construction: apiClient latches its own fired-flag so
  // this callback runs at most once per process. Still safe if it doesn't.
  if (useUpdateStore.getState().updateRequired) return;

  // Auth token is already removed by apiClient; clean up the mirrored
  // AsyncStorage key and every in-memory store the auth flow would clear
  // on a normal logout. Order: caches → domain stores → auth flag, so no
  // observer ever sees the "logged in but empty" transitional state.
  try {
    await AsyncStorage.removeItem(AUTH_TOKEN_KEY);
  } catch {
    // Best-effort — the token was already cleared by apiClient.
  }
  clearAllCaches();
  useEmployeeStore.getState().clear();
  await useAttendanceStore.getState().clear();
  await useSalaryStore.getState().clear();
  useAuthStore.setState({
    isAuthenticated: false,
    userId: null,
    token: null,
    passwordResetRequired: false,
  });

  useUpdateStore.setState({ updateRequired: true });
});
