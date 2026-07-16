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
  fetchHrIncomes,
  fetchHrIncomeCategories,
  deleteHrIncome,
  hrIncomeReportUrl,
  HrIncome,
  HrIncomeCategory,
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

export default function HrIncomeList() {
  const theme = useTheme();
  const router = useRouter();

  const [incomes, setIncomes] = useState<HrIncome[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string>('');

  // Filters
  const [search, setSearch]     = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo]     = useState('');
  const [categoryId, setCategoryId] = useState<number | null>(null);

  const [categories, setCategories] = useState<HrIncomeCategory[]>([]);
  const [catMenuVisible, setCatMenuVisible] = useState(false);

  // Suite web parity: inline per-row Delete (income:delete on templates/income/list.html).
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  // Report download — reuses hrIncomeReportUrl, respects the same filters
  // the list is currently showing (search / category / date range).
  const [busyFormat, setBusyFormat] = useState<'pdf' | 'xlsx' | null>(null);
  const handleDownload = async (fmt: 'pdf' | 'xlsx') => {
    if (busyFormat) return;
    setBusyFormat(fmt);
    try {
      const url = await hrIncomeReportUrl({
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
      const list = await fetchHrIncomes({
        search: search.trim() || undefined,
        dateFrom: dateFrom.trim() || undefined,
        dateTo: dateTo.trim() || undefined,
        category: categoryId ?? undefined,
      });
      setIncomes(list);
    } catch (err: any) {
      setError(friendlyError(err));
      setIncomes([]);
    } finally {
      setLoading(false);
    }
  }, [search, dateFrom, dateTo, categoryId]);

  // Initial load + refresh on focus (so add/edit/delete are reflected
  // when navigating back — those flows do NOT push their own results
  // into this list; a refetch on focus is the simplest correct sync).
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  // Categories fetched once via hrApi cache.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const cats = await fetchHrIncomeCategories();
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
      await deleteHrIncome(pk);
      setConfirmDeleteId(null);
      // Re-list so the removed row disappears — matches the Suite's
      // full-page reload after income:delete.
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
    // load() re-runs via useFocusEffect dep change on next focus; run now too.
    setTimeout(load, 0);
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <Stack.Screen options={{ title: 'Income Master' }} />

      <ScrollView style={styles.container}>
        <Card style={styles.card} mode="elevated" elevation={1}>
          <Card.Title
            title="Filters"
            titleStyle={{ fontWeight: 'bold', color: theme.colors.secondary }}
          />
          <Card.Content>
            <Searchbar
              placeholder="Search income…"
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
            title="Income Records"
            subtitle={loading ? 'Loading…' : `${incomes.length} row${incomes.length === 1 ? '' : 's'} · latest first`}
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
            ) : incomes.length === 0 ? (
              <Text style={{ color: '#666', textAlign: 'center', paddingVertical: 12 }}>
                No income records match the current filters.
              </Text>
            ) : (
              incomes.map((i, idx) => (
                <View key={i.id}>
                  <View
                    style={styles.row}
                  >
                    <View style={{ flex: 1 }}>
                      <Text variant="bodyLarge" style={{ fontWeight: 'bold' }}>
                        {i.amount_display || i.amount}
                      </Text>
                      <Text variant="bodyMedium" style={{ color: '#444' }}>
                        {i.date_display || i.date}
                      </Text>
                      {i.payment_by ? (
                        <Text variant="bodyMedium" style={{ color: '#666' }}>
                          {i.payment_by}
                        </Text>
                      ) : null}
                      {i.description ? (
                        <Text variant="bodySmall" style={{ color: '#888' }} numberOfLines={2}>
                          {i.description}
                        </Text>
                      ) : null}
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Button
                        mode="text"
                        compact
                        onPress={() => router.push(`/hr/income/${i.id}`)}
                      >
                        Edit
                      </Button>
                      <Button
                        mode="text"
                        compact
                        icon="delete"
                        textColor={theme.colors.error}
                        onPress={() => setConfirmDeleteId(i.id)}
                        disabled={deletingId === i.id}
                      >
                        Delete
                      </Button>
                    </View>
                  </View>
                  {idx < incomes.length - 1 && <Divider style={{ marginVertical: 8 }} />}
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
        onPress={() => router.push('/hr/income/add')}
      />

      <Portal>
        <Dialog
          visible={confirmDeleteId !== null}
          onDismiss={() => (deletingId == null ? setConfirmDeleteId(null) : undefined)}
        >
          <Dialog.Title>Delete this income record?</Dialog.Title>
          <Dialog.Content>
            <Text>Confirm deletion of this income record? This cannot be undone.</Text>
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
