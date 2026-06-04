import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AttendanceRecord } from '../types';
import { format } from 'date-fns';
import {
  fetchAttendance,
  postAttendance,
  MobileAttendanceRecord,
} from '../services/api';
import { ApiError } from '../services/apiClient';

// ---------------------------------------------------------------------------
// Direct AsyncStorage persistence (mirrors the machineStore statusList pattern).
//
// WHY NOT zustand persist middleware:
//   On cold start, `auth-storage` rehydrates first → `isAuthenticated: true` →
//   `(tabs)/_layout.tsx` immediately calls refresh(). At that instant,
//   `attendance-storage` hasn't finished its async rehydration, so `records`
//   is still `{}`. When the persist middleware eventually rehydrates it calls
//   `set({ records: storedValue })` — overwriting any records the API call
//   already placed in state. This race is non-deterministic and causes the
//   "gone after restart" bug regardless of network speed.
//
//   The direct-read approach below avoids the race entirely: we await the
//   AsyncStorage read ourselves, populate records BEFORE the API call starts,
//   and write back immediately after every mutation.
// ---------------------------------------------------------------------------

// v2: bumped to abandon stale iOS AsyncStorage records written by the old
// merge-not-replace code.  Old v1 data is silently orphaned; it is never
// read again and will be cleared by the OS as part of normal storage hygiene.
const RECORDS_KEY = '@spim-lite/attendance-records/v2';

async function loadPersistedRecords(): Promise<Record<string, AttendanceRecord>> {
  try {
    const raw = await AsyncStorage.getItem(RECORDS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      !Array.isArray(parsed)
    ) {
      return parsed as Record<string, AttendanceRecord>;
    }
    return {};
  } catch {
    return {};
  }
}

/**
 * Write records to AsyncStorage. Awaited in markAttendance() so the data
 * is guaranteed on disk before the function returns — survives immediate
 * app close. Fire-and-forget in refresh() where the UI has already updated.
 */
async function saveRecords(records: Record<string, AttendanceRecord>): Promise<void> {
  try {
    await AsyncStorage.setItem(RECORDS_KEY, JSON.stringify(records));
  } catch {
    // best effort — UI already updated optimistically
  }
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AttendanceState {
  records: Record<string, AttendanceRecord>; // Key is YYYY-MM-DD
  loading: boolean;
  loaded: boolean;

  /** Pull this employee's attendance from the SPIM Suite backend. */
  refresh: () => Promise<void>;

  /**
   * Mark attendance and persist to the backend.
   * Backend upserts on (employee, date).
   */
  markAttendance: (
    date: string,
    status: AttendanceRecord['status']
  ) => Promise<void>;

  getPresentCount: (startDate: string, endDate: string) => number;
  /** Returns count of records with the given status in [startDate, endDate], capped at today. */
  getStatusCount: (status: AttendanceRecord['status'], startDate: string, endDate: string) => number;
  /** Returns true when the record for dateStr was set by an admin (read-only). */
  isAdminLocked: (dateStr: string) => boolean;
}

// ---------------------------------------------------------------------------
// Status mappers
// ---------------------------------------------------------------------------

/**
 * Backend status → UI status
 */
function fromBackend(r: MobileAttendanceRecord): AttendanceRecord {
  const map: Record<string, AttendanceRecord['status']> = {
    present:     'Present',
    absent:      'Absent',
    half_day:    'Half Day',
    leave:       'Leave',
    week_off:    'Week Off',
    no_week_off: 'No Week Off',
    holiday:     'Holiday',
  };

  return {
    date:   r.date,
    status: map[r.status] ?? 'Absent',
    source: r.source,
    locked: !!r.locked,
  };
}

/**
 * UI status → Backend status
 */
function toBackendStatus(
  s: AttendanceRecord['status']
): 'present' | 'absent' | 'half_day' | 'leave' | 'week_off' | 'no_week_off' | 'holiday' {
  if (s === 'Present')    return 'present';
  if (s === 'Leave')      return 'leave';
  if (s === 'Half Day')   return 'half_day';
  if (s === 'Holiday')    return 'leave';
  if (s === 'Week Off')   return 'week_off';
  if (s === 'No Week Off') return 'no_week_off';
  return 'absent';
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useAttendanceStore = create<AttendanceState>((set, get) => ({
  records: {},
  loading: false,
  loaded:  false,

  refresh: async () => {
    if (get().loading) return;
    set({ loading: true });

    // ── Step 1: show persisted data immediately ──────────────────────────
    // Populate the UI with last-known data while the network call is in
    // flight so the employee sees something instantly on slow connections.
    // This snapshot is replaced wholesale by the API response in Step 3 —
    // it is never merged into or allowed to outlive the server reply.
    const stored = await loadPersistedRecords();
    if (Object.keys(stored).length > 0) {
      set({ records: stored });
    }

    // ── Step 2: fetch full payroll cycle from the network ────────────────
    // The cycle runs 26th of one month → 25th of the next. Fetch both
    // calendar months so the full history is populated.
    try {
      const today = new Date();
      const day   = today.getDate();
      let cycleStartMonth = today.getMonth();   // 0-indexed
      let cycleStartYear  = today.getFullYear();
      if (day <= 25) {
        cycleStartMonth -= 1;
        if (cycleStartMonth < 0) { cycleStartMonth = 11; cycleStartYear -= 1; }
      }
      let cycleEndMonth = cycleStartMonth + 1;
      let cycleEndYear  = cycleStartYear;
      if (cycleEndMonth > 11) { cycleEndMonth = 0; cycleEndYear += 1; }

      // Previous cycle starts one calendar month before cycleStartMonth.
      // Fetching this month covers the 26th → end-of-month rows of the
      // previous cycle (the 1st → 25th rows of the previous cycle live in
      // cycleStartMonth, which is already fetched).
      let prevCycleMonth = cycleStartMonth - 1;
      let prevCycleYear  = cycleStartYear;
      if (prevCycleMonth < 0) { prevCycleMonth = 11; prevCycleYear -= 1; }

      const startMonthStr = `${cycleStartYear}-${String(cycleStartMonth + 1).padStart(2, '0')}`;
      const endMonthStr   = `${cycleEndYear}-${String(cycleEndMonth + 1).padStart(2, '0')}`;
      const prevMonthStr  = `${prevCycleYear}-${String(prevCycleMonth + 1).padStart(2, '0')}`;

      // The 26→25 cycle always spans two calendar months — fetch both,
      // plus the previous cycle's first month so history is complete.
      const fetches = [fetchAttendance(startMonthStr)];
      if (endMonthStr !== startMonthStr) {
        fetches.push(fetchAttendance(endMonthStr));
      }
      if (prevMonthStr !== startMonthStr && prevMonthStr !== endMonthStr) {
        fetches.push(fetchAttendance(prevMonthStr));
      }
      console.log('[Attendance] Fetching months:', { prevMonthStr, startMonthStr, endMonthStr });
      const results = await Promise.all(fetches);
      console.log('[Attendance] Records per fetch:', results.map(r => r.length));
      const list    = results.flat();
      console.log('[Attendance] Total records from API:', list.length);

      // ── Step 3: API is source of truth — replace records wholesale ────
      // Never merge with local state. Any record not returned by the API
      // is gone; stale optimistic writes do not survive a successful fetch.
      const recs: Record<string, AttendanceRecord> = {};
      for (const r of list) {
        recs[r.date] = fromBackend(r);
      }
      console.log('[Attendance] Total records after API replace:', Object.keys(recs).length);
      set({ records: recs, loading: false, loaded: true });

      // ── Step 4: persist exactly what the API returned ────────────────
      saveRecords(recs);

    } catch (error) {
      console.error('Attendance refresh failed:', error);
      set({ loading: false });
    }
  },

  markAttendance: async (date, status) => {
    try {
      const saved = await postAttendance(
        toBackendStatus(status),
        date,
      );

      const markedRecord: AttendanceRecord = {
        ...fromBackend(saved),
        timeIn: format(new Date(), 'HH:mm'),
      };

      set((state) => ({
        records: {
          ...state.records,
          [date]: markedRecord,
        },
      }));

      // Await so the record is on disk before returning.
      await saveRecords(get().records);

      // Requirement: fetch fresh after every mark action so the store
      // reflects authoritative server state. Fire-and-forget — the POST
      // is already confirmed; the GET runs in the background.
      get().refresh();

    } catch (error: any) {
      if (error instanceof ApiError && error.status === 409) {
        // The server says this date is already locked. Replace local state
        // with the authoritative record returned in the 409 body and lock
        // the date so the mark UI is disabled.
        const raw = error.body?.record || error.body;
        if (raw && typeof raw === 'object' && raw.date) {
          const lockedRecord: AttendanceRecord = fromBackend({
            id:     Number(raw.id ?? 0),
            date:   String(raw.date).slice(0, 10),
            status: (raw.status ?? 'present') as MobileAttendanceRecord['status'],
            source: String(raw.source ?? 'admin'),
            locked: true,
          });
          set((state) => ({
            records: { ...state.records, [date]: lockedRecord },
          }));
          await saveRecords(get().records);
          // Refresh all dates to stay in sync after the 409.
          get().refresh();
        }
        return;
      }

      // Network or other server error: POST did not reach the server.
      // Do not write any local state — API is the only source of truth.
      // The mark UI remains visible so the employee can retry.
      console.error('Attendance mark failed:', error);
    }
  },

  getPresentCount: (startDate, endDate) => {
    const { records } = get();
    let count = 0;
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    Object.values(records).forEach((record) => {
      if (record.date < startDate || record.date > endDate) return;
      if (record.date > todayStr) return;  // don't count future dates
      // Sundays are excluded from payable working days, mirroring the Suite's
      // salary module (employees/views.py::_compute_attendance_earnings uses
      // .exclude(date__week_day=1)) — EXCEPT when explicitly marked as Holiday,
      // which is a paid day regardless of day-of-week (public holiday on Sunday).
      const isSunday = new Date(record.date + 'T00:00:00').getDay() === 0;
      if (isSunday && record.status !== 'Holiday') return;
      if (
        record.status === 'Present' ||
        record.status === 'Week Off' ||
        record.status === 'Holiday'
      ) {
        count += 1;
      } else if (record.status === 'Half Day') {
        count += 0.5;
      }
    });
    return count;
  },

  getStatusCount: (status, startDate, endDate) => {
    const { records } = get();
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    let count = 0;
    Object.values(records).forEach((record) => {
      if (record.date < startDate || record.date > endDate) return;
      if (record.date > todayStr) return;
      if (record.status === status) count += 1;
    });
    return count;
  },

  isAdminLocked: (dateStr) => get().records[dateStr]?.source === 'admin',
}));
