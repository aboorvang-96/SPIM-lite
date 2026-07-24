import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../constants/theme';

/**
 * Full-screen block rendered by the root layout when the backend has
 * returned HTTP 426. This is the ONLY UI an unsupported APK ever gets
 * to see. Deliberate constraints, all baked into the JSX below:
 *
 *   - No interactive elements at all — no `Pressable`, `TouchableOpacity`,
 *     `Button`, `Link`, or `<a>`. Nothing to tap, so nothing to bypass.
 *   - No icon, image, or decorative widget — spec requires the page to
 *     contain ONLY the title and message.
 *   - No navigation hook, no router import, no `useEffect` — so the page
 *     cannot programmatically move anywhere either.
 *   - No `BackHandler` interception: on Android the hardware back
 *     button therefore falls through to the OS default, which closes
 *     the app (the ONLY affordance the spec permits).
 *   - Rendered by RootLayout INSTEAD of the `<Stack>`, so no route
 *     — login, tabs, dashboard, attendance, machines, HR, reports —
 *     is mounted while this screen is up. There is nothing for a
 *     gesture, deep link, or router state to navigate to.
 */
export default function UpdateRequiredScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>SPIM Lite Update Required</Text>
      <Text style={styles.message}>
        This version of SPIM Lite is no longer supported.
        {'\n\n'}
        Please install Version 2.0.0 or later to continue.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 16,
    textAlign: 'center',
  },
  message: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});
