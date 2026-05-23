import React, { useEffect, useMemo, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Portal, Dialog, Text, Button, useTheme, Menu, TextInput, ActivityIndicator, HelperText } from 'react-native-paper';
import { useMachineStore } from '../../store/machineStore';
import { useEmployeeStore } from '../../store/employeeStore';
import { format } from 'date-fns';

interface Props {
  visible: boolean;
  onDismiss: () => void;
  onSaved?: () => void;
}

function MachineLogPopupInner({ visible, onDismiss, onSaved }: Props) {
  const theme = useTheme();
  const employee = useEmployeeStore(state => state.employee);
  const machines = useMachineStore(state => state.machines);
  const loaded = useMachineStore(state => state.loaded);
  const loading = useMachineStore(state => state.loading);
  const loadMachines = useMachineStore(state => state.loadMachines);
  const assignEmployeeToMachine = useMachineStore(state => state.assignEmployeeToMachine);
  const getMachineForEmployee = useMachineStore(state => state.getMachineForEmployee);

  const [menuOpen, setMenuOpen] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);
  const [saving, setSaving] = useState(false);

  const now = useMemo(() => new Date(), [visible]);
  const dateStr = format(now, 'dd MMM yyyy');
  const timeStr = format(now, 'HH:mm');

  useEffect(() => {
    if (visible && !loaded) {
      loadMachines();
    }
    if (visible && employee) {
      const existing = getMachineForEmployee(employee.id);
      setSelected(existing);
      setTouched(false);
    }
  }, [visible, loaded, employee, loadMachines, getMachineForEmployee]);

  const machineList = useMemo(() => Object.values(machines), [machines]);
  const showError = touched && !selected;

  const handleSave = () => {
    if (!employee) return;
    if (!selected) {
      setTouched(true);
      return;
    }
    setSaving(true);
    assignEmployeeToMachine(
      selected,
      employee.id,
      employee.name,
      employee.site,
      format(now, 'yyyy-MM-dd'),
      timeStr,
    );
    setSaving(false);
    onSaved?.();
    onDismiss();
  };

  if (!employee) return null;

  return (
    <Portal>
      <Dialog visible={visible} onDismiss={onDismiss} style={styles.dialog}>
        <Dialog.Title style={styles.title}>Machine Work Log</Dialog.Title>
        <Dialog.Content>
          <View style={styles.readonlyBlock}>
            <View style={styles.row}>
              <Text variant="labelMedium" style={styles.label}>Employee</Text>
              <Text variant="bodyMedium" style={styles.value}>{employee.name}</Text>
            </View>
            <View style={styles.row}>
              <Text variant="labelMedium" style={styles.label}>Employee ID</Text>
              <Text variant="bodyMedium" style={styles.value}>{employee.id}</Text>
            </View>
            <View style={styles.row}>
              <Text variant="labelMedium" style={styles.label}>Date</Text>
              <Text variant="bodyMedium" style={styles.value}>{dateStr}</Text>
            </View>
            <View style={styles.row}>
              <Text variant="labelMedium" style={styles.label}>Time</Text>
              <Text variant="bodyMedium" style={styles.value}>{timeStr}</Text>
            </View>
            <View style={styles.row}>
              <Text variant="labelMedium" style={styles.label}>Site</Text>
              <Text variant="bodyMedium" style={[styles.value, { flex: 1, textAlign: 'right' }]} numberOfLines={2}>{employee.site}</Text>
            </View>
          </View>

          <Text variant="labelLarge" style={[styles.dropdownLabel, { color: theme.colors.primary }]}>Machine Number</Text>

          {loading && !loaded ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="small" color={theme.colors.primary} />
              <Text variant="bodySmall" style={{ marginLeft: 8 }}>Loading machines...</Text>
            </View>
          ) : (
            <Menu
              visible={menuOpen}
              onDismiss={() => setMenuOpen(false)}
              anchor={
                <TextInput
                  mode="outlined"
                  value={selected ?? ''}
                  placeholder="Select Machine"
                  editable={false}
                  right={<TextInput.Icon icon={menuOpen ? 'menu-up' : 'menu-down'} onPress={() => setMenuOpen(true)} />}
                  onPressIn={() => setMenuOpen(true)}
                  error={showError}
                  dense
                />
              }
              contentStyle={{ backgroundColor: theme.colors.surface }}
            >
              {machineList.length === 0 ? (
                <Menu.Item title="No machines available" disabled />
              ) : machineList.map(m => (
                <Menu.Item
                  key={m.id}
                  title={`${m.machineNumber}  •  TMP ${m.tmpCount}`}
                  onPress={() => { setSelected(m.machineNumber); setMenuOpen(false); setTouched(true); }}
                />
              ))}
            </Menu>
          )}

          {showError && <HelperText type="error">Please select a machine number.</HelperText>}
        </Dialog.Content>
        <Dialog.Actions>
          <Button onPress={onDismiss} disabled={saving}>Cancel</Button>
          <Button mode="contained" onPress={handleSave} loading={saving} disabled={saving} icon="content-save">Save</Button>
        </Dialog.Actions>
      </Dialog>
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
  readonlyBlock: {
    paddingVertical: 8,
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  label: {
    color: '#64748B',
  },
  value: {
    fontWeight: '600',
    color: '#0F172A',
    maxWidth: '60%',
  },
  dropdownLabel: {
    fontWeight: 'bold',
    marginBottom: 6,
    marginTop: 4,
  },
  loadingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
});
