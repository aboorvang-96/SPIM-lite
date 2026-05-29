import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AttendanceRecord } from '../types';
import { format } from 'date-fns';
import {
  fetchAttendance,
  postAttendance,
  MobileAttendanceRecord,
} from '../services/api';

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

const RECORDS_KEY = '@spim-lite/attendance-records/v1';

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
    // Read directly from AsyncStorage before starting the network call.
    // This guarantees the user sees their last-known attendance the moment
    // the tab mounts, even on a slow or offline cold start. It also prevents
    // the zustand-persist race where the API response could be overwritten
    // by a late rehydration event.
    if (Object.keys(get().records).length === 0) {
      const stored = await loadPersistedRecords();
      if (Object.keys(stored).length > 0) {
        set({ records: stored });
      }
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
      const results = await Promise.all(fetches);
      const list    = results.flat();

      // ── Step 3: merge (backend is authoritative for returned dates) ───
      set((state) => {
        const recs: Record<string, AttendanceRecord> = { ...state.records };
        for (const r of list) {
          recs[r.date] = fromBackend(r);
        }
        return { records: recs, loading: false, loaded: true };
      });

      // ── Step 5: write the merged result back to AsyncStorage ─────────
      saveRecords(get().records);

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

      // Re-apply the marked record after any in-flight refresh completes,
      // preventing a concurrent fetch from overwriting the just-marked status.
      setTimeout(() => {
        const current = get().records[date];
        if (!current || current.source !== 'admin') {
          set((state) => ({
            records: { ...state.records, [date]: markedRecord },
          }));
        }
      }, 1500);

      // Await the write so the data is guaranteed on disk before this
      // function returns — survives an immediate app close after marking.
      await saveRecords(get().records);

    } catch (error) {
      console.error('Attendance update failed:', error);

      // Optimistic fallback — show the employee's intent in the UI even
      // if the network call failed; the next refresh will reconcile.
      set((state) => ({
        records: {
          ...state.records,
          [date]: {
            date,
            status,
            timeIn: format(new Date(), 'HH:mm'),
          },
        },
      }));

      // Also await so the optimistic record is on disk before returning.
      await saveRecords(get().records);
    }
  },

  getPresentCount: (startDate, endDate) => {
    const { records } = get();
    let count = 0;
    Object.values(records).forEach((record) => {
      const isPaidDay =
        record.status === 'Present' ||
        record.status === 'Week Off';
      if (
        record.date >= startDate &&
        record.date <= endDate &&
        isPaidDay
      ) {
        count++;
      }
    });
    return count;
  },

  isAdminLocked: (dateStr) => get().records[dateStr]?.source === 'admin',
}));
