import React from 'react';
import { View, StyleSheet } from 'react-native';
import { List, Text } from 'react-native-paper';
import { Stack, useRouter } from 'expo-router';

export default function HrHomeScreen() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'HR Panel' }} />
      <Text variant="titleLarge" style={styles.heading}>HR Panel</Text>
      <List.Section>
        <List.Item
          title="Attendance Viewer"
          description="View any employee's attendance"
          left={props => <List.Icon {...props} icon="calendar-search" />}
          right={props => <List.Icon {...props} icon="chevron-right" />}
          onPress={() => router.push('/hr/attendance')}
        />
        <List.Item
          title="Income Management"
          description="View, add, edit, delete income"
          left={props => <List.Icon {...props} icon="cash-plus" />}
          right={props => <List.Icon {...props} icon="chevron-right" />}
          onPress={() => router.push('/hr/income')}
        />
        <List.Item
          title="Expense Management"
          description="View, add, edit, delete expenses"
          left={props => <List.Icon {...props} icon="cash-minus" />}
          right={props => <List.Icon {...props} icon="chevron-right" />}
          onPress={() => router.push('/hr/expense')}
        />
      </List.Section>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 8,
  },
  heading: {
    fontWeight: 'bold',
    padding: 12,
  },
});
