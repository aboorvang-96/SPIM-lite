import React, { useState } from 'react';
import { View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import IncomeForm, { IncomeFieldErrors } from './_form';
import { createHrIncome, HrIncomeInput } from '../../../services/hrApi';
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

export default function HrIncomeAdd() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<IncomeFieldErrors>({});
  const [topError, setTopError] = useState<string>('');

  const handleSubmit = async (input: HrIncomeInput) => {
    setSubmitting(true);
    setFieldErrors({});
    setTopError('');
    try {
      await createHrIncome(input);
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

  return (
    <View style={{ flex: 1 }}>
      <Stack.Screen options={{ title: 'Add Income' }} />
      <IncomeForm
        submitLabel="Save Income"
        submitting={submitting}
        onSubmit={handleSubmit}
        fieldErrors={fieldErrors}
        topError={topError}
      />
    </View>
  );
}
