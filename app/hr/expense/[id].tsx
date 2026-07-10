import React, { useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { ActivityIndicator, Button, Dialog, Portal, Text } from 'react-native-paper';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import ExpenseForm, { ExpenseFieldErrors } from './_form';
import {
  fetchHrExpense,
  updateHrExpense,
  deleteHrExpense,
  HrExpense,
  HrExpenseInput,
} from '../../../services/hrApi';
import { ApiError } from '../../../services/apiClient';

function friendlyError(err: any): string {
  if (err instanceof ApiError) {
    const body = err.body;
    if (body && typeof body === 'object') {
      const serverMsg = (body.error || body.message || body.detail) ?? null;
      if (typeof serverMsg === 'string' && serverMsg.length > 0) return serverMsg;
    }
    if (typeof body === 'string' && body.includes('<html')) {
      return 'This HR endpoint is not available on the connected Suite server. Please deploy the latest Suite backend.';
    }
    if (err.status === 403) return 'You do not have HR permission for this action.';
    if (err.status === 404) return 'Requested expense was not found (HTTP 404).';
    if (err.status === 401) return 'Session expired. Please sign in again.';
    if (err.status >= 500) return 'Server error. Please try again in a moment.';
  }
  return err?.message || 'Something went wrong.';
}

export default function HrExpenseEdit() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const pk = Number(id);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string>('');
  const [expense, setExpense] = useState<HrExpense | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<ExpenseFieldErrors>({});
  const [topError, setTopError] = useState<string>('');

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setLoadError('');
      try {
        const e = await fetchHrExpense(pk);
        if (!cancelled) setExpense(e);
      } catch (err: any) {
        if (!cancelled) setLoadError(friendlyError(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [pk]);

  const handleSubmit = async (input: HrExpenseInput) => {
    setSubmitting(true);
    setFieldErrors({});
    setTopError('');
    try {
      await updateHrExpense(pk, input);
      router.back();
    } catch (err: any) {
      if (err instanceof ApiError && err.status === 400 && err.body?.errors) {
        setFieldErrors(err.body.errors as ExpenseFieldErrors);
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
      await deleteHrExpense(pk);
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
      <Stack.Screen options={{ title: 'Edit Expense' }} />

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
        <ExpenseForm
          initial={expense}
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
              Delete Expense
            </Button>
          }
        />
      )}

      <Portal>
        <Dialog visible={confirmDelete} onDismiss={() => setConfirmDelete(false)}>
          <Dialog.Title>Delete this expense record?</Dialog.Title>
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
