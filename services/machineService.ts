import { Machine, MachineLog } from '../types';
import { fetchMachines, postWorklog } from './api';

/**
 * Machine service.
 *
 * Reads the list of machines assigned to the logged-in employee directly from
 * SPIM Suite (`GET /api/mobile/machines/`). The backend derives this list
 * from WorkLog rows where the employee is in the M2M `employees` set, so the
 * dropdown only shows machines admin has actually allocated to this person.
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
   * Submit a machine work log entry. Writes directly into the Suite's
   * `projects.WorkLog` row via /api/mobile/worklogs/ — the same row the
   * Suite's Projects → Machine Work Summary reads.
   *
   * `tmp` is optional in the local MachineLog shape; if absent, the server
   * keeps whatever the existing WorkLog row already has.
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
    } catch {
      return false;
    }
  },
};
