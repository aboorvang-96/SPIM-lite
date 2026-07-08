import React from 'react';
import { View, StyleSheet } from 'react-native';
import { List, Text } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { useEmployeeStore } from '../../store/employeeStore';
import { isHrUser } from '../../utils/permissions';

export default function MoreScreen() {
  const router = useRouter();
  const employee = useEmployeeStore(state => state.employee);
  const hr = isHrUser(employee);

  // Non-HR users see the current placeholder unchanged.
  if (!hr) {
    return (
      <View style={styles.container}>
        <Text variant="titleLarge">More Options</Text>
        <Text>Settings and auxiliary features will go here.</Text>
      </View>
    );
  }

  return (
    <View style={styles.hrContainer}>
      <List.Section>
        <List.Subheader>HR</List.Subheader>
        <List.Item
          title="HR Panel"
          description="HR-only tools"
          left={props => <List.Icon {...props} icon="shield-account" />}
          right={props => <List.Icon {...props} icon="chevron-right" />}
          onPress={() => router.push('/hr')}
        />
      </List.Section>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  hrContainer: {
    flex: 1,
    padding: 8,
  },
});
