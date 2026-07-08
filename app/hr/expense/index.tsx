import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, Card, useTheme } from 'react-native-paper';
import { Stack } from 'expo-router';

/**
 * Expense Management placeholder. Actual CRUD wires up in Phase 6.
 * The HR route guard (app/hr/_layout.tsx) already protects this path.
 */
export default function HrExpensePlaceholder() {
  const theme = useTheme();
  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Stack.Screen options={{ title: 'Expense Management' }} />
      <Card style={styles.card} mode="elevated" elevation={1}>
        <Card.Title
          title="Expense Management"
          titleStyle={{ fontWeight: 'bold', color: theme.colors.secondary }}
        />
        <Card.Content>
          <Text style={styles.body}>
            HR Expense Management is not yet available. It will arrive in a future update.
          </Text>
        </Card.Content>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 12,
  },
  card: {
    borderRadius: 16,
  },
  body: {
    color: '#666',
    marginTop: 4,
  },
});
