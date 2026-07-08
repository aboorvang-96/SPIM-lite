import React, { useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { ActivityIndicator, Button, Dialog, Portal, Text } from 'react-native-paper';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import IncomeForm, { IncomeFieldErrors } from './_form';
import {
  fetchHrIncome,
  updateHrIncome,
  deleteHrIncome,
  HrIncome,
  HrIncomeInput,
} from '../../../services/hrApi';
import { ApiError } from '../../../services/apiClient';

function friendlyError(err: any): string {
  if (err instanceof ApiError) {
    if (err.status === 403) return 'You do not have HR permission for this action.';
    if (err.status === 404) return 'Income not found. It may have been deleted.';
    if (err.status === 401) return 'Session expired. Please sign in again.';
    if (err.status >= 500) return 'Server error. Please try again in a moment.';
    if (err.status === 400 && err.body?.message) return String(err.body.message);
  }
  return err?.message || 'Something went wrong.';
}

export default function HrIncomeEdit() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const pk = Number(id);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string>('');
  const [income, setIncome] = useState<HrIncome | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<IncomeFieldErrors>({});
  const [topError, setTopError] = useState<string>('');

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setLoadError('');
      try {
        const i = await fetchHrIncome(pk);
        if (!cancelled) setIncome(i);
      } catch (err: any) {
        if (!cancelled) setLoadError(friendlyError(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [pk]);

  const handleSubmit = async (input: HrIncomeInput) => {
    setSubmitting(true);
    setFieldErrors({});
    setTopError('');
    try {
      await updateHrIncome(pk, input);
      router.back();
    } catch (err: any) {
      if (err instanceof ApiError && err.status === 400 && err.body?.errors) {
        setFieldErrors(err.body.errors as IncomeFieldErrors);
        setTopError(friendlyError(err));
      } else {
        setTopError(friendlyError(err));
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteHrIncome(pk);
      setConfirmDelete(false);
      router.back();
    } catch (err: any) {
      setConfirmDelete(false);
      setTopError(friendlyError(err));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <Stack.Screen options={{ title: 'Edit Income' }} />

      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator />
          <Text style={{ marginTop: 8, color: '#666' }}>Loading…</Text>
        </View>
      ) : loadError ? (
        <View style={styles.loading}>
          <Text style={{ color: '#B00020' }}>{loadError}</Text>
        </View>
      ) : (
        <IncomeForm
          initial={income}
          submitLabel="Save Changes"
          submitting={submitting}
          onSubmit={handleSubmit}
          fieldErrors={fieldErrors}
          topError={topError}
          extraFooter={
            <Button
              mode="outlined"
              icon="delete"
              onPress={() => setConfirmDelete(true)}
              disabled={submitting || deleting}
              style={styles.deleteBtn}
              textColor="#B00020"
            >
              Delete Income
            </Button>
          }
        />
      )}

      <Portal>
        <Dialog visible={confirmDelete} onDismiss={() => setConfirmDelete(false)}>
          <Dialog.Title>Delete this income record?</Dialog.Title>
          <Dialog.Content>
            <Text>This cannot be undone.</Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setConfirmDelete(false)} disabled={deleting}>
              Cancel
            </Button>
            <Button
              onPress={handleDelete}
              loading={deleting}
              disabled={deleting}
              textColor="#B00020"
            >
              Delete
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  deleteBtn: {
    marginTop: 16,
    borderColor: '#B00020',
  },
});
