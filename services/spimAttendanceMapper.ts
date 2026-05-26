import { AttendanceRecord } from '../types';

/**
 * SPIM Suite → SPIM Lite attendance mapper (structure only).
 *
 * The desktop ERP will eventually return attendance entries in its own
 * shape (snake_case fields, ISO timestamps, numeric status codes). This
 * file defines the contract and the pure mapping function so that when
 * the real endpoint comes online, only `SpimSuiteAttendanceDTO` and the
 * status-code map need confirming — nothing in the UI or store changes.
 *
 * Do NOT add backend calls here.
 */

/** Status codes used by SPIM Suite (placeholder). */
export type SpimAttendanceStatusCode = 'P' | 'A' | 'L' | 'WO' | 'HD';

/** Raw record shape expected from SPIM Suite. */
export interface SpimSuiteAttendanceDTO {
  employee_id: string;
  attendance_date: string;  // ISO YYYY-MM-DD
  status_code: SpimAttendanceStatusCode;
  time_in?: string;         // HH:mm
  time_out?: string;        // HH:mm
  remarks?: string;
}

const STATUS_MAP: Record<SpimAttendanceStatusCode, AttendanceRecord['status'] | null> = {
  P: 'Present',
  A: 'Absent',
  L: 'Leave',
  HD: 'Leave', // Half-day mapped to Leave for now
  WO: null,    // Weekly off — not represented as a record locally
};

export const SpimAttendanceMapper = {
  /** Map a single DTO to a local AttendanceRecord (or null if not representable). */
  toLocal(dto: SpimSuiteAttendanceDTO): AttendanceRecord | null {
    const status = STATUS_MAP[dto.status_code];
    if (!status) return null;
    return {
      date: dto.attendance_date,
      status,
      timeIn: dto.time_in,
      timeOut: dto.time_out,
    };
  },

  /** Map a batch — convenient for future `GET /spim-suite/attendance` responses. */
  toLocalMany(
    dtos: SpimSuiteAttendanceDTO[],
  ): Record<string, AttendanceRecord> {
    const out: Record<string, AttendanceRecord> = {};
    for (const dto of dtos) {
      const rec = this.toLocal(dto);
      if (rec) out[rec.date] = rec;
    }
    return out;
  },
};
