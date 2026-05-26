import React, { useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import {
  Portal,
  Dialog,
  Text,
  Button,
  useTheme,
  Menu,
  TextInput,
  ActivityIndicator,
  HelperText,
  Divider,
} from 'react-native-paper';
import { format } from 'date-fns';
import { useMachineStore } from '../../store/machineStore';
import { useEmployeeStore } from '../../store/employeeStore';
import AddStatusDialog from '../machines/AddStatusDialog';
import { isMachineLogRestricted } from '../../utils/permissions';

interface Props {
  visible: boolean;
  onDismiss: () => void;
  onSaved?: () => void;
}

/**
 * Quick Machine Log popup launched right after marking attendance.
 * Uses the simplified Machine Log schema: Machine Number, Date, Status, Remarks.
 */
function MachineLogPopupInner({ visible, onDismiss, onSaved }: Props) {
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

  const dateLabel = format(new Date(), 'dd MMM yyyy');

  useEffect(() => {
    if (!visible) return;
    if (!loaded) loadMachines();
    loadStatus();
    if (employee) {
      const existing = getTodayLogForEmployee(employee.id);
      if (existing) {
        setSelectedMachine(existing.machineNo);
        setStatus(existing.status);
        setRemarks(existing.remarks);
      }
    }
    setTouched(false);
    // intentionally only rerun on visibility change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

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
      onSaved?.();
      onDismiss();
    }
  };

  const handleCancel = () => {
    resetForm();
    onDismiss();
  };

  if (!employee) return null;

  if (isMachineLogRestricted(employee)) {
    return (
      <Portal>
        <Dialog visible={visible} onDismiss={onDismiss} style={styles.dialog}>
          <Dialog.Title style={styles.title}>Machine Log</Dialog.Title>
          <Dialog.Content>
            <Text variant="titleMedium" style={{ fontWeight: 'bold', marginBottom: 8 }}>
              Access Restricted
            </Text>
            <Text variant="bodyMedium" style={{ color: '#666' }}>
              Machine logs are not available for your role / level.
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={onDismiss}>Close</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    );
  }

  return (
    <Portal>
      <Dialog visible={visible} onDismiss={handleCancel} style={styles.dialog}>
        <Dialog.Title style={styles.title}>Machine Log</Dialog.Title>
        <Dialog.Content>
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
        </Dialog.Content>
        <Dialog.Actions>
          <Button onPress={handleCancel} disabled={saving}>Cancel</Button>
          <Button
            mode="contained"
            onPress={handleSave}
            loading={saving}
            disabled={saving}
            icon="content-save"
          >
            Save
          </Button>
        </Dialog.Actions>
      </Dialog>

      <AddStatusDialog
        visible={addStatusVisible}
        onDismiss={() => setAddStatusVisible(false)}
        onAdded={(newStatus) => setStatus(newStatus)}
      />
    </Portal>
  );
}

export default React.memo(MachineLogPopupInner);

const styles = StyleSheet.create({
  dialog: {
    borderRadius: 16,
    alignSelf: 'center',
    width: '92%',
    maxWidth: 440,
  },
  title: {
    fontWeight: 'bold',
    fontSize: 18,
    paddingBottom: 0,
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
});
