import { Machine, MachineLog } from '../types';
// import { apiClient } from './api'; // Future SPIM Suite Desktop API

const MOCK_MACHINES: Machine[] = [
  { id: 'M001', machineNumber: 'Machine001', location: 'Project Alpha - North Wing', assignedEmployees: [], tmpCount: 0, attendanceCount: 0 },
  { id: 'M002', machineNumber: 'Machine002', location: 'Project Alpha - North Wing', assignedEmployees: [], tmpCount: 0, attendanceCount: 0 },
  { id: 'M003', machineNumber: 'Machine003', location: 'Project Alpha - North Wing', assignedEmployees: [], tmpCount: 0, attendanceCount: 0 },
  { id: 'M004', machineNumber: 'Machine004', location: 'Project Alpha - North Wing', assignedEmployees: [], tmpCount: 0, attendanceCount: 0 },
];

export const MachineService = {
  /**
   * Fetch machine list.
   * Future: GET /spim-suite/projects/{projectId}/machines
   */
  getMachines: async (): Promise<Machine[]> => {
    // return apiClient.get('/spim-suite/projects/current/machines').then(r => r.data);
    return Promise.resolve(MOCK_MACHINES);
  },

  /**
   * Push a machine log entry / assignment.
   * Future: POST /spim-suite/machine-logs
   */
  assignMachine: async (log: MachineLog): Promise<boolean> => {
    // return apiClient.post('/spim-suite/machine-logs', log).then(() => true);
    return Promise.resolve(true);
  },

  /**
   * Recalculate TMP server-side (future).
   */
  updateTMP: async (machineNumber: string, tmpCount: number): Promise<boolean> => {
    // return apiClient.patch(`/spim-suite/machines/${machineNumber}/tmp`, { tmpCount }).then(() => true);
    return Promise.resolve(true);
  },

  /**
   * Get machine work summary (TMP + assigned employees).
   * Future: GET /spim-suite/machines/summary
   */
  getMachineSummary: async (): Promise<Machine[]> => {
    // return apiClient.get('/spim-suite/machines/summary').then(r => r.data);
    return Promise.resolve(MOCK_MACHINES);
  },
};
