import { useEffect, useState } from 'react';
import { Platform, Text, View } from 'react-native';
import { Stack } from 'expo-router';
import { PaperProvider } from 'react-native-paper';
import { theme, colors } from '../constants/theme';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import MaxWidthWrapper from '../components/MaxWidthWrapper';
import { useMachineStore } from '../store/machineStore';
import { useAuthStore } from '../store/authStore';
// Side-effect import: installs the HTTP 426 handler on apiClient so any
// response with that status flips the store below into `updateRequired`.
import { useUpdateStore } from '../store/updateStore';
import UpdateRequiredScreen from '../components/UpdateRequiredScreen';
import { verifyAppVersion } from '../services/versionCheck';

// Web fallback for react-native-paper icons. @expo/vector-icons fonts can
// fail to render inside an iOS Safari PWA (icons show as empty checkboxes),
// so on web we substitute emoji for the icon names actually used by Paper
// components across the app. Native (iOS/Android) is untouched.
const WEB_PAPER_ICONS: Record<string, string> = {
  // login screen
  domain: '🏢',
  account: '👤',
  lock: '🔒',
  // dashboard / shared
  refresh: '🔄',
  'map-marker': '📍',
  'map-marker-outline': '📍',
  'phone-outline': '📞',
  'email-outline': '✉️',
  'cog-outline': '⚙️',
  'calendar-check': '📅',
  'cash-multiple': '💰',
  'account-cog': '👤',
  check: '✓',
  // attendance
  cog: '⚙️',
  'alert-circle-outline': '⚠️',
  pencil: '✏️',
  'hand-wave': '👋',
  // machines
  calendar: '📆',
  'content-save': '💾',
  // profile
  logout: '↩️',
};

export default function RootLayout() {
  const loadStatus = useMachineStore(state => state.loadStatus);
  const restoreSession = useAuthStore(state => state.restoreSession);
  // Latched flag set by apiClient's 426 handler (installed by updateStore
  // on import above). Once true it stays true — no in-app retry path,
  // reload requires closing the app.
  const updateRequired = useUpdateStore(state => state.updateRequired);

  // Gate every downstream side effect (session restore, machine hydration,
  // Stack mount) on a single startup version probe. Until this flips true
  // we render nothing but a blank background — no route, no auth, no
  // data-loading. If the probe surfaces HTTP 426, `updateRequired` is
  // already latched by the time this state flips, and the render branch
  // below will pick UpdateRequiredScreen instead of the Stack.
  const [versionChecked, setVersionChecked] = useState(false);

  useEffect(() => {
    // verifyAppVersion swallows network errors internally (fail-open on
    // transport failure) and returns after the shared apiFetch has already
    // routed any 426 through the store. Safe to fire-and-forget.
    let cancelled = false;
    verifyAppVersion().finally(() => {
      if (!cancelled) setVersionChecked(true);
    });
    return () => { cancelled = true; };
  }, []);

  // Hydrate persisted machine-status list — deferred until after the
  // version probe completes AND the backend has accepted this build.
  // A rejected build must never touch machine data.
  useEffect(() => {
    if (!versionChecked || updateRequired) return;
    loadStatus();
  }, [versionChecked, updateRequired, loadStatus]);

  // Rehydrate any persisted session AsyncStorage already holds so a
  // returning user lands on the tab tree instead of bouncing back to
  // login. Gated for the same reason as loadStatus above: on an
  // unsupported build we must not call fetchProfile (which would leak
  // identity to a client the backend has already declared obsolete)
  // and we must not surface an authenticated UI even briefly.
  useEffect(() => {
    if (!versionChecked || updateRequired) return;
    restoreSession();
  }, [versionChecked, updateRequired, restoreSession]);

  // Register the PWA service worker on web so Safari "Add to Home Screen"
  // installs work and static assets are cached for offline resilience.
  useEffect(() => {
    if (Platform.OS === 'web' && 'serviceWorker' in navigator) {
      (navigator as any).serviceWorker
        .register('/sw.js')
        .then(() => console.log('SW registered'))
        .catch((err: unknown) => console.log('SW error:', err));
    }
  }, []);

  return (
    <SafeAreaProvider>
      <PaperProvider
        theme={theme}
        settings={{
          icon: (props: any) => {
            if (Platform.OS === 'web') {
              const emoji = WEB_PAPER_ICONS[props?.name];
              if (emoji) {
                return (
                  <Text style={{ fontSize: props?.size ?? 20, color: props?.color, lineHeight: (props?.size ?? 20) + 2 }}>
                    {emoji}
                  </Text>
                );
              }
            }
            return <MaterialCommunityIcons {...props} />;
          },
        }}
      >
        <MaxWidthWrapper>
          {/*
            Render priority (top wins):
              1. updateRequired  → UpdateRequiredScreen. Highest priority in
                 the app: even if the probe hasn't finished (e.g. a 426
                 came from a later request during the probe window), a
                 latched update flag beats everything else.
              2. !versionChecked → blank background. No route, no login,
                 no dashboard. This is what an unsupported APK will show
                 for a brief moment before the 426 arrives and flips
                 updateRequired, guaranteeing no application content ever
                 renders on such a build.
              3. otherwise       → normal Stack (auth/tabs), unchanged.
          */}
          {updateRequired ? (
            <UpdateRequiredScreen />
          ) : !versionChecked ? (
            <View style={{ flex: 1, backgroundColor: colors.background }} />
          ) : (
            <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: 'transparent' } }}>
              <Stack.Screen name="(auth)" options={{ headerShown: false }} />
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            </Stack>
          )}
        </MaxWidthWrapper>
      </PaperProvider>
    </SafeAreaProvider>
  );
}
