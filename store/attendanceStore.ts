import { create } from 'zustand';
import { AttendanceRecord } from '../types';
import { format } from 'date-fns';
import {
  fetchAttendance,
  postAttendance,
  MobileAttendanceRecord,
} from '../services/api';

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
}

/**
 * Backend status → UI status
 */
function fromBackend(r: MobileAttendanceRecord): AttendanceRecord {
  const map: Record<string, AttendanceRecord['status']> = {
    present: 'Present',
    absent: 'Absent',
    half_day: 'Half Day',
    leave: 'Leave',
    week_off: 'Week Off',
    no_week_off: 'No Week Off',
    holiday: 'Holiday',
  };

  return {
    date: r.date,
    status: map[r.status] ?? 'Absent',
  };
}

/**
 * UI status → Backend status
 */
function toBackendStatus(
  s: AttendanceRecord['status']
): 'present' | 'absent' | 'half_day' | 'leave' | 'week_off' | 'no_week_off' | 'holiday' {

  if (s === 'Present') return 'present';

  if (s === 'Leave') return 'leave';

  if (s === 'Half Day') return 'half_day';

  if (s === 'Holiday') return 'leave';

  // IMPORTANT FIX
  if (s === 'Week Off') return 'week_off';

  if (s === 'No Week Off') return 'no_week_off';

  return 'absent';
}

export const useAttendanceStore = create<AttendanceState>((set, get) => ({
  records: {},
  loading: false,
  loaded: false,

  refresh: async () => {
    if (get().loading) return;

    set({ loading: true });

    try {
      const list = await fetchAttendance();

      const recs: Record<string, AttendanceRecord> = {};

      for (const r of list) {
        recs[r.date] = fromBackend(r);
      }

      set({
        records: recs,
        loading: false,
        loaded: true,
      });

    } catch (error) {
      console.error('Attendance refresh failed:', error);

      set({
        loading: false,
      });
    }
  },

  markAttendance: async (date, status) => {
    try {
      const saved = await postAttendance(
        toBackendStatus(status),
        date
      );

      set((state) => ({
        records: {
          ...state.records,
          [date]: {
            ...fromBackend(saved),
            timeIn: format(new Date(), 'HH:mm'),
          },
        },
      }));

    } catch (error) {
      console.error('Attendance update failed:', error);

      // Optimistic fallback
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
}));