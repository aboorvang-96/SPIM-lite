import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { persist, createJSONStorage } from 'zustand/middleware';

interface AuthState {
  isAuthenticated: boolean;
  userId: string | null;          // employee_id (e.g. SPIM001) — kept for back-compat
  token: string | null;           // bearer token returned by /api/mobile/login/
  passwordResetRequired: boolean;
  /**
   * Persist a successful login. Token is also written to AsyncStorage under
   * the key `mobile_auth_token` so the axios interceptor in services/api.ts
   * can attach it to subsequent requests.
   */
  setAuth: (params: { userId: string; token: string; passwordResetRequired?: boolean }) => Promise<void>;
  /** Compatibility shim: legacy callers may still call login(userId). */
  login: (userId: string) => void;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      isAuthenticated: false,
      userId: null,
      token: null,
      passwordResetRequired: false,
      setAuth: async ({ userId, token, passwordResetRequired }) => {
        await AsyncStorage.setItem('mobile_auth_token', token);
        set({
          isAuthenticated: true,
          userId,
          token,
          passwordResetRequired: !!passwordResetRequired,
        });
      },
      login: (userId: string) => set({ isAuthenticated: true, userId }),
      logout: async () => {
        await AsyncStorage.removeItem('mobile_auth_token');
        set({ isAuthenticated: false, userId: null, token: null, passwordResetRequired: false });
      },
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
