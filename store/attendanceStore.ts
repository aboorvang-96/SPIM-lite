import { create } from 'zustand';
import { AttendanceRecord } from '../types';
import { format } from 'date-fns';

interface AttendanceState {
  records: Record<string, AttendanceRecord>; // Key is YYYY-MM-DD
  markAttendance: (date: string, status: 'Present' | 'Absent' | 'Leave') => void;
  getPresentCount: (startDate: string, endDate: string) => number;
}

export const useAttendanceStore = create<AttendanceState>((set, get) => ({
  records: {
    '2026-05-19': { date: '2026-05-19', status: 'Present', timeIn: '08:00', timeOut: '17:00' },
  },
  markAttendance: (date, status) => set((state) => ({
    records: {
      ...state.records,
      [date]: { date, status, timeIn: format(new Date(), 'HH:mm') }
    }
  })),
  getPresentCount: (startDate, endDate) => {
    const { records } = get();
    let count = 0;
    Object.values(records).forEach(record => {
      if (record.date >= startDate && record.date <= endDate && record.status === 'Present') {
        count++;
      }
    });
    return count;
  }
}));
