import React, { useEffect, useMemo, useState } from 'react';
import { View, StyleSheet, ScrollView, Linking, Alert } from 'react-native';
import {
  Text,
  Card,
  Button,
  ActivityIndicator,
  TextInput,
  Menu,
  useTheme,
} from 'react-native-paper';
import { Stack } from 'expo-router';
import { format } from 'date-fns';
import {
  fetchHrExpenseCategories,
  hrExpenseReportUrl,
  HrExpenseCategory,
} from '../../../services/hrApi';
import { ApiError } from '../../../services/apiClient';

// ---------------------------------------------------------------------------
// Cycle helper — kept in step with the attendance + income report screens
// so all three default to the same 26→25 window.
// ---------------------------------------------------------------------------

interface Cycle {
  start: Date;
  end: Date;
  startISO: string;
  endISO: string;
  label: string;
}

function cycleForAnchor(anchor: Date): Cycle {
  let startMonth = anchor.getMonth();
  let startYear = anchor.getFullYear();
  if (anchor.getDate() <= 25) {
    startMonth -= 1;
    if (startMonth < 0) {
      startMonth = 11;
      startYear -= 1;
    }
  }
  const start = new Date(startYear, startMonth, 26);
  let endMonth = startMonth + 1;
  let endYear = startYear;
  if (endMonth > 11) {
    endMonth = 0;
    endYear += 1;
  }
  const end = new Date(endYear, endMonth, 25);
  return {
    start,
    end,
    startISO: format(start, 'yyyy-MM-dd'),
    endISO:   format(end,   'yyyy-MM-dd'),
    label:    `${format(start, 'dd MMM yyyy')} – ${format(end, 'dd MMM yyyy')}`,
  };
}

function shiftCycle(cycle: Cycle, months: number): Cycle {
  // Anchor on cycle.start (already day 26). Using cycle.end (day 25)
  // + setMonth(±m) + setDate(26) landed on the start of cycle N+m+1, so
  // -1 was a no-op and +1 skipped one. Every month has a day 26, so no
  // month-overflow drift.
  const anchor = new Date(cycle.start);
  anchor.setMonth(anchor.getMonth() + months);
  return cycleForAnchor(anchor);
}

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
    if (err.status === 403) return 'You do not have HR permission for this data.';
    if (err.status === 404) return 'Requested data was not found (HTTP 404).';
    if (err.status === 401) return 'Session expired. Please sign in again.';
    if (err.status >= 500) return 'Server error. Please try again in a moment.';
  }
  if (err?.message && typeof err.message === 'string') return err.message;
  return 'Something went wrong. Please try again.';
}

// ---------------------------------------------------------------------------

export default function HrExpenseReport() {
  const theme = useTheme();

  const [categories, setCategories] = useState<HrExpenseCategory[]>([]);
  const [catLoading, setCatLoading] = useState(true);
  const [catError, setCatError] = useState<string>('');
  const [catMenuVisible, setCatMenuVisible] = useState(false);
  // `null` = "All categories"; otherwise the category pk.
  const [categoryId, setCategoryId] = useState<number | null>(null);

  const [search, setSearch] = useState('');

  const [cycle, setCycle] = useState<Cycle>(() => cycleForAnchor(new Date()));

  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo]     = useState('');

  const [busyFormat, setBusyFormat] = useState<'pdf' | 'xlsx' | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setCatLoading(true);
      setCatError('');
      try {
        const cats = await fetchHrExpenseCategories();
        if (!cancelled) setCategories(cats);
      } catch (err: any) {
        if (!cancelled) setCatError(friendlyError(err));
      } finally {
        if (!cancelled) setCatLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const selectedCategoryLabel = useMemo(() => {
    if (categoryId == null) return 'All categories';
    return categories.find(c => c.id === categoryId)?.name || 'All categories';
  }, [categoryId, categories]);

  const effectiveFrom = customFrom.trim() || cycle.startISO;
  const effectiveTo   = customTo.trim()   || cycle.endISO;

  const scopeLabel = search.trim()
    ? `Search matches "${search.trim()}"`
    : 'All Expenses';

  const handleDownload = async (fmt: 'pdf' | 'xlsx') => {
    if (busyFormat) return;
    setBusyFormat(fmt);
    try {
      const url = await hrExpenseReportUrl({
        search:   search.trim() || undefined,
        category: categoryId ?? 'all',
        dateFrom: effectiveFrom,
        dateTo:   effectiveTo,
        format:   fmt,
      });
      await Linking.openURL(url);
    } catch (err: any) {
      Alert.alert('Report unavailable', friendlyError(err));
    } finally {
      setBusyFormat(null);
    }
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Stack.Screen options={{ title: 'Expense Reports' }} />

      <Card style={styles.card} mode="elevated" elevation={1}>
        <Card.Title
          title="Report Cycle"
          subtitle={cycle.label}
          titleStyle={{ fontWeight: 'bold', color: theme.colors.secondary }}
        />
        <Card.Content>
          <View style={styles.cycleRow}>
            <Button
              mode="outlined"
              icon="chevron-left"
              compact
              onPress={() => setCycle(shiftCycle(cycle, -1))}
            >
              Previous
            </Button>
            <Button mode="text" compact onPress={() => setCycle(cycleForAnchor(new Date()))}>
              Current
            </Button>
            <Button
              mode="outlined"
              icon="chevron-right"
              contentStyle={{ flexDirection: 'row-reverse' }}
              compact
              onPress={() => setCycle(shiftCycle(cycle, 1))}
            >
              Next
            </Button>
          </View>
        </Card.Content>
      </Card>

      <Card style={styles.card} mode="elevated" elevation={1}>
        <Card.Title
          title="Custom Date Range (optional)"
          subtitle="Overrides the cycle above when both values are set"
          titleStyle={{ fontWeight: 'bold', color: theme.colors.secondary }}
          subtitleNumberOfLines={2}
        />
        <Card.Content>
          <View style={styles.row}>
            <TextInput
              mode="outlined"
              label="Date From (YYYY-MM-DD)"
              value={customFrom}
              onChangeText={setCustomFrom}
              style={styles.rowInput}
              dense
            />
            <TextInput
              mode="outlined"
              label="Date To (YYYY-MM-DD)"
              value={customTo}
              onChangeText={setCustomTo}
              style={styles.rowInput}
              dense
            />
          </View>
          {(customFrom || customTo) ? (
            <Button
              mode="text"
              compact
              onPress={() => { setCustomFrom(''); setCustomTo(''); }}
              style={{ alignSelf: 'flex-end', marginTop: 4 }}
            >
              Clear range
            </Button>
          ) : null}
        </Card.Content>
      </Card>

      <Card style={styles.card} mode="elevated" elevation={1}>
        <Card.Title
          title="Filters"
          subtitle="Search matches description / vendor / reference / expense type / from / source (same as the Expense list)"
          titleStyle={{ fontWeight: 'bold', color: theme.colors.secondary }}
          subtitleNumberOfLines={3}
        />
        <Card.Content>
          <TextInput
            mode="outlined"
            label="Search (optional)"
            value={search}
            onChangeText={setSearch}
            placeholder="Leave blank for all expenses"
            style={styles.input}
            dense
          />

          <Menu
            visible={catMenuVisible}
            onDismiss={() => setCatMenuVisible(false)}
            anchor={
              <TextInput
                mode="outlined"
                label="Category"
                value={selectedCategoryLabel}
                editable={false}
                right={
                  <TextInput.Icon
                    icon={catMenuVisible ? 'menu-up' : 'menu-down'}
                    onPress={() => setCatMenuVisible(true)}
                  />
                }
                onPressIn={() => setCatMenuVisible(true)}
                style={styles.input}
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
            {catLoading ? (
              <View style={styles.loadingBox}>
                <ActivityIndicator />
              </View>
            ) : catError ? (
              <Text style={{ color: theme.colors.error, padding: 12 }}>{catError}</Text>
            ) : categories.length === 0 ? (
              <Text style={{ padding: 12, color: '#666' }}>No categories yet.</Text>
            ) : (
              categories.map(c => (
                <Menu.Item
                  key={c.id}
                  title={c.name}
                  onPress={() => {
                    setCategoryId(c.id);
                    setCatMenuVisible(false);
                  }}
                />
              ))
            )}
          </Menu>
        </Card.Content>
      </Card>

      <Card style={styles.card} mode="elevated" elevation={1}>
        <Card.Title
          title="Download"
          subtitle={`${scopeLabel} · ${effectiveFrom} → ${effectiveTo}`}
          titleStyle={{ fontWeight: 'bold', color: theme.colors.secondary }}
          subtitleNumberOfLines={2}
        />
        <Card.Content>
          <View style={styles.downloadRow}>
            <Button
              mode="contained"
              icon="file-pdf-box"
              onPress={() => handleDownload('pdf')}
              loading={busyFormat === 'pdf'}
              disabled={busyFormat !== null}
              style={{ flex: 1 }}
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
            >
              Excel
            </Button>
          </View>
          <Text style={{ color: '#666', marginTop: 8, fontSize: 12 }}>
            The file opens in your device browser and is streamed by the
            SPIM Suite server — no data is generated on-device.
          </Text>
        </Card.Content>
      </Card>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 12 },
  card: { borderRadius: 16, marginBottom: 12 },
  cycleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  rowInput: { flex: 1 },
  input: { marginTop: 8 },
  loadingBox: { alignItems: 'center', paddingVertical: 16 },
  downloadRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
});
