import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { persist, createJSONStorage } from 'zustand/middleware';
import {
  AUTH_TOKEN_KEY,
  setAuthToken,
  clearAuthToken,
  getAuthToken,
  setUnauthorizedHandler,
} from '../services/apiClient';
import { mobileLogout, fetchProfile } from '../services/api';

interface AuthState {
  isAuthenticated: boolean;
  userId: string | null;          // employee_id (e.g. SPIM001) — kept for back-compat
  token: string | null;           // Bearer token returned by /api/mobile/login/
  orgCode: string | null;         // Org Code entered at login (e.g. ADM00001 / CLIENT001)
  passwordResetRequired: boolean;
  /**
   * Persist a successful login. Mirrors the bearer token into AsyncStorage
   * (under `mobile_auth_token`) so apiClient can inject it into every
   * subsequent request, and stores the UI-relevant identity fields in zustand.
   */
  setAuth: (params: {
    userId: string;
    token: string;
    orgCode: string;
    passwordResetRequired?: boolean;
  }) => Promise<void>;
  /** Compatibility shim: legacy callers may still call login(userId). */
  login: (userId: string) => void;
  logout: () => Promise<void>;
  /**
   * Cold-start hook: rehydrates `isAuthenticated` / `token` from the persisted
   * AsyncStorage token and verifies it by calling /profile/. Safe to call
   * multiple times.
   */
  restoreSession: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      isAuthenticated: false,
      userId: null,
      token: null,
      orgCode: null,
      passwordResetRequired: false,

      setAuth: async ({ userId, token, orgCode, passwordResetRequired }) => {
        await setAuthToken(token);
        set({
          isAuthenticated: true,
          userId,
          token,
          orgCode,
          passwordResetRequired: !!passwordResetRequired,
        });
      },

      login: (userId: string) => set({ isAuthenticated: true, userId }),

      logout: async () => {
        await mobileLogout();
        await clearAuthToken();
        // orgCode is intentionally preserved so the login form auto-fills
        // it next time — the employee stays at the same organisation.
        set({
          isAuthenticated: false,
          userId: null,
          token: null,
          passwordResetRequired: false,
          // orgCode: unchanged
        });
      },

      restoreSession: async () => {
        const token = await getAuthToken();
        if (!token) {
          set({ isAuthenticated: false, userId: null, token: null });
          return;
        }
        // Verify the token still works and resolve the latest identity from
        // /profile/. If verification fails (401 → handled by apiClient, which
        // clears the token), bounce back to unauthenticated state.
        try {
          const resp = await fetchProfile();
          if (!resp.success || !resp.profile) {
            await clearAuthToken();
            set({ isAuthenticated: false, userId: null, token: null });
            return;
          }
          const existingOrgCode = get().orgCode;
          set({
            isAuthenticated: true,
            userId: resp.profile.employee_id || resp.profile.login_id || '',
            token,
            orgCode: existingOrgCode,
            passwordResetRequired: false,
          });
        } catch {
          await clearAuthToken();
          set({ isAuthenticated: false, userId: null, token: null });
        }
      },
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);

// Wire apiClient's 401 handler to clear store state. This way any 401 from
// any request automatically logs the user out of the UI as well as the
// transport layer.
setUnauthorizedHandler(async () => {
  // Reuse AsyncStorage key constant so a future rename remains in sync.
  await AsyncStorage.removeItem(AUTH_TOKEN_KEY);
  useAuthStore.setState({
    isAuthenticated: false,
    userId: null,
    token: null,
    passwordResetRequired: false,
  });
});
