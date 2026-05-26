import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import {
  Text,
  Surface,
  Card,
  useTheme,
  Menu,
  TextInput,
  Button,
  HelperText,
  ActivityIndicator,
  Divider,
} from 'react-native-paper';
import { format } from 'date-fns';
import { useMachineStore } from '../../store/machineStore';
import { useEmployeeStore } from '../../store/employeeStore';
import AddStatusDialog from '../../components/machines/AddStatusDialog';
import { isMachineLogRestricted } from '../../utils/permissions';

export default function MachinesScreen() {
  const theme = useTheme();
  const employee = useEmployeeStore(state => state.employee);

  const machineList = useMachineStore(state => state.machineList);
  const loaded = useMachineStore(state => state.loaded);
  const loading = useMachineStore(state => state.loading);
  const loadMachines = useMachineStore(state => state.loadMachines);

  const statusList = useMachineStore(state => state.statusList);
  const loadStatus = useMachineStore(state => state.loadStatus);

  const selectedMachine = useMachineStore(state => state.selectedMachine);
  const status = useMachineStore(state => state.status);
  const remarks = useMachineStore(state => state.remarks);
  const setSelectedMachine = useMachineStore(state => state.setSelectedMachine);
  const setStatus = useMachineStore(state => state.setStatus);
  const setRemarks = useMachineStore(state => state.setRemarks);
  const resetForm = useMachineStore(state => state.resetForm);
  const saveLog = useMachineStore(state => state.saveLog);
  const getTodayLogForEmployee = useMachineStore(state => state.getTodayLogForEmployee);

  const [machineMenu, setMachineMenu] = useState(false);
  const [statusMenu, setStatusMenu] = useState(false);
  const [addStatusVisible, setAddStatusVisible] = useState(false);
  const [touched, setTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedMessage, setSavedMessage] = useState('');

  useEffect(() => {
    loadMachines();
    loadStatus();
  }, [loadMachines, loadStatus]);

  const today = new Date();
  const dateLabel = format(today, 'dd MMM yyyy');
  const todayLog = employee ? getTodayLogForEmployee(employee.id) : undefined;
  const restricted = isMachineLogRestricted(employee);

  if (restricted) {
    return (
      <ScrollView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <Text variant="titleLarge" style={[styles.heading, { color: theme.colors.primary }]}>
          Machine Log
        </Text>
        <Card style={styles.summaryCard} mode="elevated" elevation={1}>
          <Card.Content>
            <Text variant="titleMedium" style={{ fontWeight: 'bold', marginBottom: 8, textAlign: 'center' }}>
              Access Restricted
            </Text>
            <Text variant="bodyMedium" style={{ color: '#666', textAlign: 'center' }}>
              Machine logs are not available for your role / level.
            </Text>
          </Card.Content>
        </Card>
      </ScrollView>
    );
  }

  const machineError = touched && !selectedMachine;
  const statusError = touched && !status;

  const handleSave = async () => {
    if (!employee) return;
    if (!selectedMachine || !status) {
      setTouched(true);
      return;
    }
    setSaving(true);
    const ok = await saveLog(employee.id);
    setSaving(false);
    if (ok) {
      setSavedMessage('Machine log saved.');
      setTouched(false);
      setTimeout(() => setSavedMessage(''), 2500);
    }
  };

  const handleCancel = () => {
    resetForm();
    setTouched(false);
    setSavedMessage('');
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Text variant="titleLarge" style={[styles.heading, { color: theme.colors.primary }]}>
        Machine Log
      </Text>

      <Surface style={styles.formCard} elevation={2}>
        {/* Machine Number */}
        <Text variant="labelLarge" style={[styles.fieldLabel, { color: theme.colors.primary }]}>
          Machine Number
        </Text>
        {loading && !loaded ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator size="small" color={theme.colors.primary} />
            <Text variant="bodySmall" style={{ marginLeft: 8 }}>Loading machines...</Text>
          </View>
        ) : (
          <Menu
            visible={machineMenu}
            onDismiss={() => setMachineMenu(false)}
            anchor={
              <TextInput
                mode="outlined"
                value={selectedMachine ?? ''}
                placeholder="Select Machine"
                editable={false}
                right={
                  <TextInput.Icon
                    icon={machineMenu ? 'menu-up' : 'menu-down'}
                    onPress={() => setMachineMenu(true)}
                  />
                }
                onPressIn={() => setMachineMenu(true)}
                error={machineError}
                dense
              />
            }
            contentStyle={{ backgroundColor: theme.colors.surface }}
          >
            {machineList.length === 0 ? (
              <Menu.Item title="No machines available" disabled />
            ) : (
              machineList.map(m => (
                <Menu.Item
                  key={m.id}
                  title={m.machineNo}
                  onPress={() => {
                    setSelectedMachine(m.machineNo);
                    setMachineMenu(false);
                  }}
                />
              ))
            )}
          </Menu>
        )}
        {machineError && <HelperText type="error">Please select a machine number.</HelperText>}

        {/* Date (read-only) */}
        <Text variant="labelLarge" style={[styles.fieldLabel, { color: theme.colors.primary }]}>
          Date
        </Text>
        <TextInput
          mode="outlined"
          value={dateLabel}
          editable={false}
          left={<TextInput.Icon icon="calendar" />}
          dense
        />

        {/* Status */}
        <Text variant="labelLarge" style={[styles.fieldLabel, { color: theme.colors.primary }]}>
          Status
        </Text>
        <Menu
          visible={statusMenu}
          onDismiss={() => setStatusMenu(false)}
          anchor={
            <TextInput
              mode="outlined"
              value={status ?? ''}
              placeholder="Select Status"
              editable={false}
              right={
                <TextInput.Icon
                  icon={statusMenu ? 'menu-up' : 'menu-down'}
                  onPress={() => setStatusMenu(true)}
                />
              }
              onPressIn={() => setStatusMenu(true)}
              error={statusError}
              dense
            />
          }
          contentStyle={{ backgroundColor: theme.colors.surface }}
        >
          {statusList.map((s) => (
            <Menu.Item
              key={s}
              title={s}
              onPress={() => {
                setStatus(s);
                setStatusMenu(false);
              }}
            />
          ))}
          <Divider />
          <Menu.Item
            leadingIcon="plus-circle-outline"
            title="Add New Status"
            titleStyle={{ color: theme.colors.primary, fontWeight: '600' }}
            onPress={() => {
              setStatusMenu(false);
              setAddStatusVisible(true);
            }}
          />
        </Menu>
        {statusError && <HelperText type="error">Please select a status.</HelperText>}

        {/* Remarks */}
        <Text variant="labelLarge" style={[styles.fieldLabel, { color: theme.colors.primary }]}>
          Remarks
        </Text>
        <TextInput
          mode="outlined"
          value={remarks}
          onChangeText={setRemarks}
          placeholder="Optional remarks"
          multiline
          numberOfLines={3}
          style={styles.remarks}
        />

        {savedMessage ? (
          <Text style={[styles.savedMessage, { color: (theme.colors as any).success ?? '#10B981' }]}>
            {savedMessage}
          </Text>
        ) : null}

        <View style={styles.actionsRow}>
          <Button
            mode="outlined"
            onPress={handleCancel}
            disabled={saving}
            style={styles.actionButton}
          >
            Cancel
          </Button>
          <Button
            mode="contained"
            icon="content-save"
            onPress={handleSave}
            loading={saving}
            disabled={saving}
            style={styles.actionButton}
          >
            Save
          </Button>
        </View>
      </Surface>

      <Text variant="titleLarge" style={[styles.heading, { color: theme.colors.primary, marginTop: 24 }]}>
        Today's Machine Work
      </Text>

      {todayLog ? (
        <Card style={styles.summaryCard} mode="elevated" elevation={1}>
          <Card.Content>
            <View style={styles.summaryRow}>
              <Text variant="labelMedium" style={styles.summaryLabel}>Machine Number</Text>
              <Text variant="bodyMedium" style={styles.summaryValue}>{todayLog.machineNo}</Text>
            </View>
            <Divider style={styles.summaryDivider} />
            <View style={styles.summaryRow}>
              <Text variant="labelMedium" style={styles.summaryLabel}>Date</Text>
              <Text variant="bodyMedium" style={styles.summaryValue}>
                {format(new Date(todayLog.date), 'dd MMM yyyy')}
              </Text>
            </View>
            <Divider style={styles.summaryDivider} />
            <View style={styles.summaryRow}>
              <Text variant="labelMedium" style={styles.summaryLabel}>Status</Text>
              <Text variant="bodyMedium" style={styles.summaryValue}>{todayLog.status}</Text>
            </View>
            <Divider style={styles.summaryDivider} />
            <View style={styles.summaryRow}>
              <Text variant="labelMedium" style={styles.summaryLabel}>Remarks</Text>
              <Text
                variant="bodyMedium"
                style={[styles.summaryValue, { flex: 1, textAlign: 'right' }]}
                numberOfLines={3}
              >
                {todayLog.remarks ? todayLog.remarks : '—'}
              </Text>
            </View>
          </Card.Content>
        </Card>
      ) : (
        <Card style={styles.summaryCard} mode="elevated" elevation={1}>
          <Card.Content>
            <Text variant="bodyMedium" style={{ color: '#666', textAlign: 'center' }}>
              No machine work logged for today yet.
            </Text>
          </Card.Content>
        </Card>
      )}

      <View style={{ height: 40 }} />

      <AddStatusDialog
        visible={addStatusVisible}
        onDismiss={() => setAddStatusVisible(false)}
        onAdded={(newStatus) => setStatus(newStatus)}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  heading: {
    fontWeight: 'bold',
    marginBottom: 12,
    marginTop: 8,
  },
  formCard: {
    padding: 16,
    borderRadius: 16,
  },
  fieldLabel: {
    fontWeight: 'bold',
    marginTop: 12,
    marginBottom: 6,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  remarks: {
    minHeight: 80,
  },
  savedMessage: {
    marginTop: 12,
    textAlign: 'center',
    fontWeight: '600',
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 16,
  },
  actionButton: {
    marginLeft: 8,
    borderRadius: 8,
  },
  summaryCard: {
    borderRadius: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  summaryLabel: {
    color: '#64748B',
  },
  summaryValue: {
    fontWeight: '600',
    color: '#0F172A',
    maxWidth: '60%',
  },
  summaryDivider: {
    backgroundColor: '#E2E8F0',
  },
});
