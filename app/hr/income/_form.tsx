import React, { useMemo, useState } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { TextInput, Button, HelperText, Text } from 'react-native-paper';
import { HrIncome, HrIncomeInput } from '../../../services/hrApi';

/**
 * Shared Income form — used by both add.tsx and [id].tsx so both paths
 * present exactly the same field set the Suite's IncomeForm accepts.
 * All validation lives on the server (IncomeForm); this component just
 * collects the fields and surfaces field-level errors from the API.
 *
 * The underscore prefix marks the file as private to expo-router so it
 * does not create a route.
 */

export type IncomeFieldErrors = Record<string, string[]>;

interface Props {
  initial?: HrIncome | null;
  submitLabel: string;
  submitting: boolean;
  onSubmit: (input: HrIncomeInput) => void;
  fieldErrors?: IncomeFieldErrors;
  topError?: string;
  extraFooter?: React.ReactNode;
}

export default function IncomeForm({
  initial,
  submitLabel,
  submitting,
  onSubmit,
  fieldErrors,
  topError,
  extraFooter,
}: Props) {
  const [amount, setAmount]           = useState(initial?.amount ?? '');
  const [date, setDate]               = useState(initial?.date ?? todayISO());
  const [description, setDescription] = useState(initial?.description ?? '');
  const [paymentMode, setPaymentMode] = useState(initial?.payment_mode ?? '');
  const [incomeType, setIncomeType]   = useState(initial?.income_type ?? '');
  const [locationSite, setLocationSite] = useState(initial?.location ?? '');
  const [paymentBy, setPaymentBy]     = useState(initial?.payment_by ?? '');
  const [fromAccount, setFromAccount] = useState(initial?.from_account ?? '');
  const [toAccount, setToAccount]     = useState(initial?.to_account ?? '');
  const [remarks, setRemarks]         = useState(initial?.remarks ?? '');

  const errs = useMemo<IncomeFieldErrors>(
    () => fieldErrors ?? {},
    [fieldErrors],
  );

  const err = (name: string): string => (errs[name] && errs[name][0]) || '';

  const canSubmit = amount.trim().length > 0 && date.trim().length > 0 && !submitting;

  const handleSubmit = () => {
    onSubmit({
      amount:        amount.trim(),
      date:          date.trim(),
      description:   description.trim(),
      payment_mode:  paymentMode.trim(),
      income_type:   incomeType.trim(),
      location_site: locationSite.trim(),
      payment_by:    paymentBy.trim(),
      from_account:  fromAccount.trim(),
      to_account:    toAccount.trim(),
      remarks:       remarks.trim(),
    });
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {topError ? (
        <Text style={styles.topError}>{topError}</Text>
      ) : null}

      <TextInput
        mode="outlined"
        label="Amount *"
        value={amount}
        onChangeText={setAmount}
        keyboardType="decimal-pad"
        error={!!err('amount')}
        style={styles.input}
      />
      {err('amount') ? <HelperText type="error" visible>{err('amount')}</HelperText> : null}

      <TextInput
        mode="outlined"
        label="Date * (YYYY-MM-DD)"
        value={date}
        onChangeText={setDate}
        placeholder="2026-07-08"
        error={!!err('date')}
        style={styles.input}
      />
      {err('date') ? <HelperText type="error" visible>{err('date')}</HelperText> : null}

      <TextInput
        mode="outlined"
        label="Income Source (payment_by)"
        value={paymentBy}
        onChangeText={setPaymentBy}
        error={!!err('payment_by')}
        style={styles.input}
      />
      {err('payment_by') ? <HelperText type="error" visible>{err('payment_by')}</HelperText> : null}

      <TextInput
        mode="outlined"
        label="Account (payment_mode)"
        value={paymentMode}
        onChangeText={setPaymentMode}
        error={!!err('payment_mode')}
        style={styles.input}
      />
      {err('payment_mode') ? <HelperText type="error" visible>{err('payment_mode')}</HelperText> : null}

      <TextInput
        mode="outlined"
        label="Income Type"
        value={incomeType}
        onChangeText={setIncomeType}
        error={!!err('income_type')}
        style={styles.input}
      />
      {err('income_type') ? <HelperText type="error" visible>{err('income_type')}</HelperText> : null}

      <TextInput
        mode="outlined"
        label="Location / Site"
        value={locationSite}
        onChangeText={setLocationSite}
        error={!!err('location_site')}
        style={styles.input}
      />
      {err('location_site') ? <HelperText type="error" visible>{err('location_site')}</HelperText> : null}

      <TextInput
        mode="outlined"
        label="From Account"
        value={fromAccount}
        onChangeText={setFromAccount}
        error={!!err('from_account')}
        style={styles.input}
      />
      {err('from_account') ? <HelperText type="error" visible>{err('from_account')}</HelperText> : null}

      <TextInput
        mode="outlined"
        label="To Account"
        value={toAccount}
        onChangeText={setToAccount}
        error={!!err('to_account')}
        style={styles.input}
      />
      {err('to_account') ? <HelperText type="error" visible>{err('to_account')}</HelperText> : null}

      <TextInput
        mode="outlined"
        label="Description"
        value={description}
        onChangeText={setDescription}
        multiline
        numberOfLines={3}
        error={!!err('description')}
        style={styles.input}
      />
      {err('description') ? <HelperText type="error" visible>{err('description')}</HelperText> : null}

      <TextInput
        mode="outlined"
        label="Remarks"
        value={remarks}
        onChangeText={setRemarks}
        error={!!err('remarks')}
        style={styles.input}
      />
      {err('remarks') ? <HelperText type="error" visible>{err('remarks')}</HelperText> : null}

      <Button
        mode="contained"
        onPress={handleSubmit}
        loading={submitting}
        disabled={!canSubmit}
        style={styles.submit}
      >
        {submitLabel}
      </Button>

      {extraFooter}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

function todayISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

const styles = StyleSheet.create({
  container: {
    padding: 12,
  },
  input: {
    marginTop: 8,
  },
  topError: {
    color: '#B00020',
    marginBottom: 8,
    textAlign: 'center',
  },
  submit: {
    marginTop: 16,
    borderRadius: 8,
    paddingVertical: 4,
  },
});
