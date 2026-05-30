import { useEffect } from 'react';
import { Platform } from 'react-native';
import { Stack } from 'expo-router';
import { PaperProvider } from 'react-native-paper';
import { theme } from '../constants/theme';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import MaxWidthWrapper from '../components/MaxWidthWrapper';
import { useMachineStore } from '../store/machineStore';
import { useAuthStore } from '../store/authStore';

export default function RootLayout() {
  const loadStatus = useMachineStore(state => state.loadStatus);
  const restoreSession = useAuthStore(state => state.restoreSession);

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
          icon: props => <MaterialCommunityIcons {...props} />,
        }}
      >
        <MaxWidthWrapper>
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: 'transparent' } }}>
            <Stack.Screen name="(auth)" options={{ headerShown: false }} />
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          </Stack>
        </MaxWidthWrapper>
      </PaperProvider>
    </SafeAreaProvider>
  );
}
