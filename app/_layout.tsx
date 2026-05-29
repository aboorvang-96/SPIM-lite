import { useEffect } from 'react';
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
