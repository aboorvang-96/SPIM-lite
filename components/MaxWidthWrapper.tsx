import React from 'react';
import { View, StyleSheet, Platform, Image } from 'react-native';

export default function MaxWidthWrapper({ children }: { children: React.ReactNode }) {
  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <View style={styles.contentInner}>
          {children}
        </View>
        {/* Global logo watermark — fixed, centered, low opacity. Rendered
            AFTER children so it overlays them, with pointerEvents="none" so
            it never blocks taps on buttons / inputs. Sits above the screens'
            opaque backgrounds (which would otherwise cover a behind-content
            watermark). */}
        <View
          style={styles.watermarkLayer}
          pointerEvents="none"
        >
          <Image
            source={require('../Logo/Logo.png')}
            style={styles.watermarkImage}
            resizeMode="contain"
          />
        </View>
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
    elevation: Platform.OS === 'web' ? 0 : 5,
  },
  contentInner: {
    flex: 1,
  },
  watermarkLayer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  watermarkImage: {
    width: '70%',
    height: '70%',
    opacity: 0.08,
  },
});
