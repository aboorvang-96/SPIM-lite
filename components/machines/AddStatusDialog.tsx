import React, { useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';
import {
  Portal,
  Dialog,
  TextInput,
  Button,
  HelperText,
  useTheme,
} from 'react-native-paper';
import { useMachineStore } from '../../store/machineStore';

interface Props {
  visible: boolean;
  onDismiss: () => void;
  /** Called with the newly-added status name so the parent can auto-select it. */
  onAdded?: (statusName: string) => void;
}

/**
 * Compact modal to add a new machine status. Validates empty input,
 * blocks duplicates (case-insensitive), and persists via the machine store.
 */
export default function AddStatusDialog({ visible, onDismiss, onAdded }: Props) {
  const theme = useTheme();
  const addStatus = useMachineStore(state => state.addStatus);
  const statusList = useMachineStore(state => state.statusList);

  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) {
      setName('');
      setError('');
      setSaving(false);
    }
  }, [visible]);

  const trimmed = name.trim();
  const isDuplicate = !!trimmed && statusList.some(
    s => s.toLowerCase() === trimmed.toLowerCase()
  );

  const handleSave = async () => {
    if (!trimmed) {
      setError('Status name cannot be empty.');
      return;
    }
    if (isDuplicate) {
      setError('This status already exists.');
      return;
    }
    setSaving(true);
    const ok = await addStatus(trimmed);
    setSaving(false);
    if (!ok) {
      setError('Could not save status. Please try a different name.');
      return;
    }
    onAdded?.(trimmed);
    onDismiss();
  };

  return (
    <Portal>
      <Dialog visible={visible} onDismiss={onDismiss} style={styles.dialog}>
        <Dialog.Title style={styles.title}>Add New Status</Dialog.Title>
        <Dialog.Content>
          <TextInput
            mode="outlined"
            label="Status Name"
            value={name}
            onChangeText={(t) => { setName(t); if (error) setError(''); }}
            placeholder="e.g. Under Repair"
            autoCapitalize="words"
            error={!!error || isDuplicate}
            dense
          />
          {!!error && <HelperText type="error">{error}</HelperText>}
          {!error && isDuplicate && (
            <HelperText type="error">This status already exists.</HelperText>
          )}
        </Dialog.Content>
        <Dialog.Actions>
          <Button onPress={onDismiss} disabled={saving}>Cancel</Button>
          <Button
            mode="contained"
            onPress={handleSave}
            loading={saving}
            disabled={saving}
            icon="content-save"
            buttonColor={theme.colors.primary}
          >
            Save
          </Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}

const styles = StyleSheet.create({
  dialog: {
    borderRadius: 16,
    alignSelf: 'center',
    width: '92%',
    maxWidth: 400,
  },
  title: {
    fontWeight: 'bold',
    fontSize: 18,
    paddingBottom: 0,
  },
});
