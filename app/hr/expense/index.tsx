import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, StyleSheet, ScrollView, Linking, Alert } from 'react-native';
import {
  Text,
  Card,
  Searchbar,
  Button,
  Divider,
  ActivityIndicator,
  Menu,
  TextInput,
  FAB,
  Dialog,
  Portal,
  useTheme,
} from 'react-native-paper';
import { Stack, useRouter, useFocusEffect } from 'expo-router';
import {
  fetchHrExpenses,
  fetchHrExpenseCategories,
  deleteHrExpense,
  hrExpenseReportUrl,
  HrExpense,
  HrExpenseCategory,
} from '../../../services/hrApi';
import { ApiError } from '../../../services/apiClient';

function friendlyError(err: any): string {
  if (err instanceof ApiError) {
    const body = err.body;
    if (body && typeof body === 'object') {
      const serverMsg =
        (body.error || body.message || body.detail) ?? null;
      if (typeof serverMsg === 'string' && serverMsg.length > 0) return serverMsg;
    }
    if (typeof body === 'string' && body.includes('<html')) {
      return 'This HR endpoint is not available on the connected Suite server. Please deploy the latest Suite backend.';
    }
    if (err.status === 403) return 'You do not have HR permission for this data.';
    if (err.status === 404) return 'Requested data was not found (HTTP 404).';
    if (err.status === 401) return 'Session expired. Please sign in again.';
    if (err.status >= 500) return 'Server error. Please try again in a moment.';
  }
  if (err?.message && typeof err.message === 'string') return err.message;
  return 'Something went wrong. Please try again.';
}

export default function HrExpenseList() {
  const theme = useTheme();
  const router = useRouter();

  const [expenses, setExpenses] = useState<HrExpense[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string>('');

  const [search, setSearch]     = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo]     = useState('');
  const [categoryId, setCategoryId] = useState<number | null>(null);

  const [categories, setCategories] = useState<HrExpenseCategory[]>([]);
  const [catMenuVisible, setCatMenuVisible] = useState(false);

  // Suite web parity: inline per-row Delete (finance:delete_transaction on
  // templates/finance/list.html).
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  // Report download — reuses hrExpenseReportUrl, respects the same filters
  // the list is currently showing (search / category / date range).
  const [busyFormat, setBusyFormat] = useState<'pdf' | 'xlsx' | null>(null);
  const handleDownload = async (fmt: 'pdf' | 'xlsx') => {
    if (busyFormat) return;
    setBusyFormat(fmt);
    try {
      const url = await hrExpenseReportUrl({
        search:   search.trim() || undefined,
        category: categoryId ?? 'all',
        dateFrom: dateFrom.trim(),
        dateTo:   dateTo.trim(),
        format:   fmt,
      });
      await Linking.openURL(url);
    } catch (err: any) {
      Alert.alert('Report unavailable', friendlyError(err));
    } finally {
      setBusyFormat(null);
    }
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const list = await fetchHrExpenses({
        search: search.trim() || undefined,
        dateFrom: dateFrom.trim() || undefined,
        dateTo: dateTo.trim() || undefined,
        category: categoryId ?? undefined,
      });
      setExpenses(list);
    } catch (err: any) {
      setError(friendlyError(err));
      setExpenses([]);
    } finally {
      setLoading(false);
    }
  }, [search, dateFrom, dateTo, categoryId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const cats = await fetchHrExpenseCategories();
        if (!cancelled) setCategories(cats);
      } catch {
        // Category dropdown is optional — swallow.
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const selectedCategoryName = useMemo(() => {
    if (categoryId == null) return 'All categories';
    return categories.find(c => c.id === categoryId)?.name || 'All categories';
  }, [categoryId, categories]);

  const handleApplyFilters = () => {
    load();
  };

  const handleDelete = async (pk: number) => {
    setDeletingId(pk);
    try {
      await deleteHrExpense(pk);
      setConfirmDeleteId(null);
      await load();
    } catch (err: any) {
      setConfirmDeleteId(null);
      setError(friendlyError(err));
    } finally {
      setDeletingId(null);
    }
  };
  const handleClearFilters = () => {
    setSearch('');
    setDateFrom('');
    setDateTo('');
    setCategoryId(null);
    setTimeout(load, 0);
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <Stack.Screen options={{ title: 'Expense Master' }} />

      <ScrollView style={styles.container}>
        <Card style={styles.card} mode="elevated" elevation={1}>
          <Card.Title
            title="Filters"
            titleStyle={{ fontWeight: 'bold', color: theme.colors.secondary }}
          />
          <Card.Content>
            <Searchbar
              placeholder="Search expenses…"
              value={search}
              onChangeText={setSearch}
              style={styles.searchbar}
            />

            <View style={styles.row}>
              <TextInput
                mode="outlined"
                label="Date From (YYYY-MM-DD)"
                value={dateFrom}
                onChangeText={setDateFrom}
                style={styles.rowInput}
                dense
              />
              <TextInput
                mode="outlined"
                label="Date To (YYYY-MM-DD)"
                value={dateTo}
                onChangeText={setDateTo}
                style={styles.rowInput}
                dense
              />
            </View>

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
                  style={{ marginTop: 8 }}
                  dense
                />
              }
              contentStyle={{ backgroundColor: theme.colors.surface }}
            >
              <Menu.Item
                title="All categories"
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

            <View style={styles.filterButtons}>
              <Button mode="contained" onPress={handleApplyFilters} compact>
                Apply
              </Button>
              <Button mode="text" onPress={handleClearFilters} compact>
                Clear
              </Button>
            </View>

            <Divider style={{ marginTop: 12 }} />
            <View style={styles.downloadRow}>
              <Button
                mode="contained"
                icon="file-pdf-box"
                onPress={() => handleDownload('pdf')}
                loading={busyFormat === 'pdf'}
                disabled={busyFormat !== null}
                style={{ flex: 1 }}
                compact
              >
                PDF
              </Button>
              <Button
                mode="contained-tonal"
                icon="file-excel-box"
                onPress={() => handleDownload('xlsx')}
                loading={busyFormat === 'xlsx'}
                disabled={busyFormat !== null}
                style={{ flex: 1 }}
                compact
              >
                Excel
              </Button>
            </View>
          </Card.Content>
        </Card>

        <Card style={styles.card} mode="elevated" elevation={1}>
          <Card.Title
            title="Expense Records"
            subtitle={loading ? 'Loading…' : `${expenses.length} row${expenses.length === 1 ? '' : 's'} · latest first`}
            titleStyle={{ fontWeight: 'bold', color: theme.colors.secondary }}
          />
          <Card.Content>
            {loading ? (
              <View style={styles.loadingBox}>
                <ActivityIndicator />
                <Text style={{ marginTop: 8, color: '#666' }}>Loading…</Text>
              </View>
            ) : error ? (
              <Text style={{ color: theme.colors.error }}>{error}</Text>
            ) : expenses.length === 0 ? (
              <Text style={{ color: '#666', textAlign: 'center', paddingVertical: 12 }}>
                No expense records match the current filters.
              </Text>
            ) : (
              expenses.map((e, idx) => (
                <View key={e.id}>
                  <View style={styles.row}>
                    <View style={{ flex: 1 }}>
                      <Text variant="bodyLarge" style={{ fontWeight: 'bold' }}>
                        {e.amount_display || e.amount}
                      </Text>
                      <Text variant="bodyMedium" style={{ color: '#444' }}>
                        {e.date_display || e.date}
                      </Text>
                      {e.category ? (
                        <Text variant="bodyMedium" style={{ color: '#666' }}>
                          {e.category}
                        </Text>
                      ) : null}
                      {e.expense_type ? (
                        <Text variant="bodyMedium" style={{ color: '#666' }}>
                          {e.expense_type}
                        </Text>
                      ) : null}
                      {e.description ? (
                        <Text variant="bodySmall" style={{ color: '#888' }} numberOfLines={2}>
                          {e.description}
                        </Text>
                      ) : null}
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Button
                        mode="text"
                        compact
                        onPress={() => router.push(`/hr/expense/${e.id}`)}
                      >
                        Edit
                      </Button>
                      <Button
                        mode="text"
                        compact
                        icon="delete"
                        textColor={theme.colors.error}
                        onPress={() => setConfirmDeleteId(e.id)}
                        disabled={deletingId === e.id}
                      >
                        Delete
                      </Button>
                    </View>
                  </View>
                  {idx < expenses.length - 1 && <Divider style={{ marginVertical: 8 }} />}
                </View>
              ))
            )}
          </Card.Content>
        </Card>

        <View style={{ height: 80 }} />
      </ScrollView>

      <FAB
        icon="plus"
        label="Add"
        style={[styles.fab, { backgroundColor: theme.colors.primary }]}
        color={theme.colors.onPrimary}
        onPress={() => router.push('/hr/expense/add')}
      />

      <Portal>
        <Dialog
          visible={confirmDeleteId !== null}
          onDismiss={() => (deletingId == null ? setConfirmDeleteId(null) : undefined)}
        >
          <Dialog.Title>Delete this expense record?</Dialog.Title>
          <Dialog.Content>
            <Text>Confirm deletion of this expense record? This cannot be undone.</Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button
              onPress={() => setConfirmDeleteId(null)}
              disabled={deletingId != null}
            >
              Cancel
            </Button>
            <Button
              onPress={() => confirmDeleteId != null && handleDelete(confirmDeleteId)}
              loading={deletingId != null}
              disabled={deletingId != null}
              textColor={theme.colors.error}
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
  container: { flex: 1, padding: 12 },
  card: { borderRadius: 16, marginBottom: 12 },
  searchbar: { marginBottom: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  rowInput: { flex: 1 },
  filterButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 12,
  },
  loadingBox: { alignItems: 'center', paddingVertical: 24 },
  downloadRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 16,
  },
});
