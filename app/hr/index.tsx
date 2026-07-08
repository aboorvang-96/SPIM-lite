import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import { Stack } from 'expo-router';

export default function HrHomeScreen() {
  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'HR Panel' }} />
      <Text variant="titleLarge">HR Panel</Text>
      <Text style={styles.body}>
        HR tools will appear here. Income, Expense and Reports are not yet available.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  body: {
    textAlign: 'center',
    marginTop: 12,
    color: '#666',
  },
});
