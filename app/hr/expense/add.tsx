import React, { useState } from 'react';
import { View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import ExpenseForm, { ExpenseFieldErrors } from './_form';
import { createHrExpense, HrExpenseInput } from '../../../services/hrApi';
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
    if (err.status === 401) return 'Session expired. Please sign in again.';
    if (err.status >= 500) return 'Server error. Please try again in a moment.';
  }
  return err?.message || 'Something went wrong.';
}

export default function HrExpenseAdd() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<ExpenseFieldErrors>({});
  const [topError, setTopError] = useState<string>('');

  const handleSubmit = async (input: HrExpenseInput) => {
    setSubmitting(true);
    setFieldErrors({});
    setTopError('');
    try {
      await createHrExpense(input);
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

  return (
    <View style={{ flex: 1 }}>
      <Stack.Screen options={{ title: 'Add Expense' }} />
      <ExpenseForm
        submitLabel="Save Expense"
        submitting={submitting}
        onSubmit={handleSubmit}
        fieldErrors={fieldErrors}
        topError={topError}
      />
    </View>
  );
}
