import { StyleSheet, Text, View } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { colors } from '../constants/theme';

/**
 * Full-screen block rendered by the root layout when the backend has
 * returned HTTP 426. Deliberately has zero interactive elements — no
 * buttons, no links, no retry — so the "close the app" contract from the
 * spec is the only user affordance. Because the root layout swaps this in
 * for the entire Stack, no route (attendance, machine logs, HR, login)
 * is reachable from here.
 */
export default function UpdateRequiredScreen() {
  return (
    <View style={styles.container}>
      <View style={styles.iconWrap}>
        <MaterialCommunityIcons name="cellphone-arrow-down" size={56} color={colors.primary} />
      </View>
      <Text style={styles.title}>Update Required</Text>
      <Text style={styles.message}>
        Your version of SPIM Lite is no longer supported.
        {'\n\n'}
        Please install Version 2.0.0 to continue.
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
  iconWrap: {
    width: 104,
    height: 104,
    borderRadius: 52,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
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
