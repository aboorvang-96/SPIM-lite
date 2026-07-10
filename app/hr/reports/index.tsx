import React from 'react';
import { View, StyleSheet } from 'react-native';
import { List, Text } from 'react-native-paper';
import { Stack, useRouter } from 'expo-router';

export default function HrReportsHome() {
  const router = useRouter();
  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'HR Reports' }} />
      <Text variant="titleLarge" style={styles.heading}>Reports</Text>
      <List.Section>
        <List.Item
          title="Attendance Reports"
          description="Download PDF / Excel by employee or cycle"
          left={props => <List.Icon {...props} icon="file-chart" />}
          right={props => <List.Icon {...props} icon="chevron-right" />}
          onPress={() => router.push('/hr/reports/attendance')}
        />
        <List.Item
          title="Income Reports"
          description="Download PDF / Excel by party, category, or cycle"
          left={props => <List.Icon {...props} icon="file-document" />}
          right={props => <List.Icon {...props} icon="chevron-right" />}
          onPress={() => router.push('/hr/reports/income')}
        />
        <List.Item
          title="Expense Reports"
          description="Download PDF / Excel by search, category, or cycle"
          left={props => <List.Icon {...props} icon="file-document-outline" />}
          right={props => <List.Icon {...props} icon="chevron-right" />}
          onPress={() => router.push('/hr/reports/expense')}
        />
      </List.Section>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 8 },
  heading:   { fontWeight: 'bold', padding: 12 },
});
