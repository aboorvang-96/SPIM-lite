import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';

export default function MoreScreen() {
  return (
    <View style={styles.container}>
      <Text variant="titleLarge">More Options</Text>
      <Text>Settings and auxiliary features will go here.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  }
});
