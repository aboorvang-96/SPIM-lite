import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';

export default function MaxWidthWrapper({ children }: { children: React.ReactNode }) {
  return (
    <View style={styles.container}>
      <View style={styles.content}>
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#E2E8F0', // Soft slate for desktop outer background
    alignItems: 'center',
  },
  content: {
    flex: 1,
    width: '100%',
    maxWidth: Platform.OS === 'web' ? 480 : '100%',
    backgroundColor: '#F8FAFC', // Inner app background
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 30,
    elevation: Platform.OS === 'web' ? 0 : 5, // Elevation mostly needed on web via shadow, but good fallback
  }
});
