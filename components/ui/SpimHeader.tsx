import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * Shared header bar used across every SPIM Lite tab.
 *
 * Layout:
 *   LEFT  — current screen title (passed in from the tabs layout via the
 *           navigator's `options.title`).
 *   CENTER — "SPIM" wordmark in navy (#0B1F4D).
 *
 * Wired in app/(tabs)/_layout.tsx via screenOptions.header so every tab
 * picks it up automatically — no per-screen change required.
 */
export interface SpimHeaderProps {
  /** Screen title (e.g. "Dashboard", "Attendance"). */
  title?: string;
}

export default function SpimHeader({ title }: SpimHeaderProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View
      style={[
        styles.bar,
        {
          paddingTop: insets.top,
          // Navy brand background — clear separation from page content.
          backgroundColor: '#0B1F4D',
          borderBottomColor: '#0B1F4D',
        },
      ]}
    >
      <View style={styles.row}>
        {/* Module name removed from the header — the bottom tab bar already
            labels every tab, so showing it again here was redundant. The
            `title` prop is retained for back-compat but no longer rendered.
            Left/right spacers remain so the centered SPIM brand stays
            visually centered. */}
        <View style={styles.left} />
        <View style={styles.center} pointerEvents="none">
          <Text style={styles.brand}>SPIM</Text>
        </View>
        <View style={styles.right} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  row: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  left: {
    flex: 1,
    justifyContent: 'center',
  },
  center: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  right: {
    width: 60,
  },
  title: {
    fontWeight: '700',
    fontSize: 16,
  },
  brand: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 20,
    letterSpacing: 1.5,
  },
});
