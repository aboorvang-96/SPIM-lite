import { Machine, MachineLog } from '../types';
import { fetchMachines, fetchWorklogs, postWorklog } from './api';

/**
 * Machine service.
 *
 * Reads the list of machines available to the logged-in employee directly
 * from Supabase (`machine_locations` table, tenant-scoped by admin_id via
 * RLS). The Suite's WorkLog M2M membership still drives which machines an
 * employee has actually worked on; this list is the broader picker.
 */
export const MachineService = {
  /** Fetch the assigned machine numbers for the logged-in employee. */
  getMachines: async (): Promise<Machine[]> => {
    try {
      const list = await fetchMachines();
      return list.map(m => ({ id: m.id, machineNo: m.machine_no }));
    } catch {
      return [];
    }
  },

  /**
   * Submit a machine work log entry. Writes directly into Supabase
   * (`work_logs` + `work_log_employees`) — the same rows the Suite's
   * Projects → Machine Work Summary reads via its Postgres DSN.
   *
   * `tmp` is optional in the local MachineLog shape; if absent it is
   * persisted as 0 on the row.
   */
  saveMachineLog: async (log: MachineLog): Promise<boolean> => {
    try {
      await postWorklog({
        machine_no: log.machineNo,
        status:     log.status || '',
        remarks:    log.remarks || '',
        tmp:        (log as any).tmp,
        date:       log.date,
      });
      return true;
    } catch (err: any) {
      // Surface the underlying Supabase / PostgREST message so missing
      // required columns or RLS rejections aren't lost to a silent catch.
      console.warn('[MachineService.saveMachineLog] failed:', err?.message || err);
      return false;
    }
  },

  /**
   * Pull today's persisted machine work log for the current employee from
   * Supabase. Used for cold-start hydration so the "Today's Machine Work"
   * card and the dashboard chip stay populated across app reloads.
   *
   * Returns the mapped MachineLog (in the local shape) or null when no
   * entry exists for today / on error. `employeeId` is the SPIM employee
   * code (e.g. "SPIM001") used as the local logs key — matches the value
   * machineStore.saveLog stores under.
   */
  getTodayMachineLog: async (employeeId: string): Promise<MachineLog | null> => {
    try {
      const today = (() => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      })();
      const all = await fetchWorklogs();
      const todays = all.find(w => w.date === today);
      if (!todays) return null;
      return {
        employeeId,
        machineNo: todays.location || '',
        date:      todays.date,
        status:    todays.work_details || '',
        remarks:   todays.remarks || '',
      };
    } catch (err: any) {
      console.warn('[MachineService.getTodayMachineLog] failed:', err?.message || err);
      return null;
    }
  },
};
