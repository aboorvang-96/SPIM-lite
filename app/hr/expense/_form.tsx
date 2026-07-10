import React, { useEffect, useMemo, useState } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { TextInput, Button, HelperText, Text, Menu } from 'react-native-paper';
import {
  HrExpense,
  HrExpenseInput,
  HrExpenseCategory,
  fetchHrExpenseCategories,
} from '../../../services/hrApi';

export type ExpenseFieldErrors = Record<string, string[]>;

interface Props {
  initial?: HrExpense | null;
  submitLabel: string;
  submitting: boolean;
  onSubmit: (input: HrExpenseInput) => void;
  fieldErrors?: ExpenseFieldErrors;
  topError?: string;
  extraFooter?: React.ReactNode;
}

export default function ExpenseForm({
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
  const [categoryId, setCategoryId]   = useState<number | null>(initial?.category_id ?? null);
  const [expenseCategory, setExpenseCategory] = useState(initial?.expense_category ?? '');
  const [purpose, setPurpose]         = useState(initial?.expense_type ?? '');
  const [locationSite, setLocationSite] = useState(initial?.location ?? '');
  const [paymentBy, setPaymentBy]     = useState(initial?.payment_by ?? '');
  const [vendor, setVendor]           = useState(initial?.payment_to ?? '');
  const [paymentMode, setPaymentMode] = useState(initial?.payment_mode ?? '');
  const [incomeSource, setIncomeSource] = useState(initial?.income_source ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');

  const [categories, setCategories] = useState<HrExpenseCategory[]>([]);
  const [catMenuVisible, setCatMenuVisible] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const cats = await fetchHrExpenseCategories();
        if (!cancelled) setCategories(cats);
      } catch {
        // Optional dropdown — server still validates category id.
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const errs = useMemo<ExpenseFieldErrors>(
    () => fieldErrors ?? {},
    [fieldErrors],
  );

  const err = (name: string): string => (errs[name] && errs[name][0]) || '';

  const canSubmit = amount.trim().length > 0 && date.trim().length > 0 && !submitting;

  const selectedCategoryName = useMemo(() => {
    if (categoryId == null) return 'No category';
    return categories.find(c => c.id === categoryId)?.name || 'No category';
  }, [categoryId, categories]);

  const handleSubmit = () => {
    onSubmit({
      amount:           amount.trim(),
      date:             date.trim(),
      category:         categoryId ?? '',
      expense_category: expenseCategory.trim(),
      purpose:          purpose.trim(),
      location_site:    locationSite.trim(),
      payment_by:       paymentBy.trim(),
      vendor:           vendor.trim(),
      payment_mode:     paymentMode.trim(),
      income_source:    incomeSource.trim(),
      description:      description.trim(),
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

      <Menu
        visible={catMenuVisible}
        onDismiss={() => setCatMenuVisible(false)}
        anchor={
          <TextInput
            mode="outlined"
            label="Category"
            value={selectedCategoryName}
            editable={false}
            right={
              <TextInput.Icon
                icon={catMenuVisible ? 'menu-up' : 'menu-down'}
                onPress={() => setCatMenuVisible(true)}
              />
            }
            onPressIn={() => setCatMenuVisible(true)}
            error={!!err('category')}
            style={styles.input}
          />
        }
      >
        <Menu.Item
          title="No category"
          onPress={() => {
            setCategoryId(null);
            setCatMenuVisible(false);
          }}
        />
        {categories.map(c => (
          <Menu.Item
            key={c.id}
            title={c.name}
            onPress={() => {
              setCategoryId(c.id);
              setCatMenuVisible(false);
            }}
          />
        ))}
      </Menu>
      {err('category') ? <HelperText type="error" visible>{err('category')}</HelperText> : null}

      <TextInput
        mode="outlined"
        label="Expense Type (purpose)"
        value={purpose}
        onChangeText={setPurpose}
        error={!!err('purpose')}
        style={styles.input}
      />
      {err('purpose') ? <HelperText type="error" visible>{err('purpose')}</HelperText> : null}

      <TextInput
        mode="outlined"
        label="Expense Category Code"
        value={expenseCategory}
        onChangeText={setExpenseCategory}
        placeholder="food / fuel / ticket / travel / other"
        error={!!err('expense_category')}
        style={styles.input}
      />
      {err('expense_category') ? <HelperText type="error" visible>{err('expense_category')}</HelperText> : null}

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
        label="From (payment_by)"
        value={paymentBy}
        onChangeText={setPaymentBy}
        error={!!err('payment_by')}
        style={styles.input}
      />
      {err('payment_by') ? <HelperText type="error" visible>{err('payment_by')}</HelperText> : null}

      <TextInput
        mode="outlined"
        label="To (vendor)"
        value={vendor}
        onChangeText={setVendor}
        error={!!err('vendor')}
        style={styles.input}
      />
      {err('vendor') ? <HelperText type="error" visible>{err('vendor')}</HelperText> : null}

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
        label="Income Source"
        value={incomeSource}
        onChangeText={setIncomeSource}
        error={!!err('income_source')}
        style={styles.input}
      />
      {err('income_source') ? <HelperText type="error" visible>{err('income_source')}</HelperText> : null}

      <TextInput
        mode="outlined"
        label="Description / Remarks"
        value={description}
        onChangeText={setDescription}
        multiline
        numberOfLines={3}
        error={!!err('description')}
        style={styles.input}
      />
      {err('description') ? <HelperText type="error" visible>{err('description')}</HelperText> : null}

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
