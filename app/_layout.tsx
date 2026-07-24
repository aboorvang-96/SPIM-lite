import { useEffect } from 'react';
import { Platform, Text } from 'react-native';
import { Stack } from 'expo-router';
import { PaperProvider } from 'react-native-paper';
import { theme } from '../constants/theme';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import MaxWidthWrapper from '../components/MaxWidthWrapper';
import { useMachineStore } from '../store/machineStore';
import { useAuthStore } from '../store/authStore';
// Side-effect import: installs the HTTP 426 handler on apiClient so any
// response with that status flips the store below into `updateRequired`.
import { useUpdateStore } from '../store/updateStore';
import UpdateRequiredScreen from '../components/UpdateRequiredScreen';

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

  // Hydrate persisted machine-status list as early as possible so the
  // dropdown reflects any custom statuses without waiting for the
  // Machine Log screen to mount.
  useEffect(() => { loadStatus(); }, [loadStatus]);

  // Rehydrate any Supabase session AsyncStorage already holds so a returning
  // user lands on the tab tree instead of bouncing back to login.
  useEffect(() => { restoreSession(); }, [restoreSession]);

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
          {updateRequired ? (
            // Replaces the whole navigation tree — no route (login, tabs,
            // HR) mounts, so nothing can navigate to Home or anywhere
            // else while this screen is up.
            <UpdateRequiredScreen />
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
