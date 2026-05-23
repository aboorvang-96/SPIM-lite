import { create } from 'zustand';
import { Machine, MachineLog } from '../types';
import { MachineService } from '../services/machineService';

interface MachineState {
  machines: Record<string, Machine>; // keyed by machineNumber
  logs: MachineLog[];
  loaded: boolean;
  loading: boolean;
  loadMachines: () => Promise<void>;
  assignEmployeeToMachine: (machineNumber: string, employeeId: string, employeeName: string, location: string, date: string, time: string) => void;
  getMachineForEmployee: (employeeId: string) => string | null;
  getTodayLogForEmployee: (employeeId: string, date: string) => MachineLog | undefined;
  getMachineSummary: () => Machine[];
}

export const useMachineStore = create<MachineState>((set, get) => ({
  machines: {},
  logs: [],
  loaded: false,
  loading: false,

  loadMachines: async () => {
    if (get().loaded || get().loading) return;
    set({ loading: true });
    const list = await MachineService.getMachines();
    const map: Record<string, Machine> = {};
    list.forEach(m => { map[m.machineNumber] = { ...m, assignedEmployees: [...m.assignedEmployees], tmpCount: m.assignedEmployees.length }; });
    // preserve any existing assignments if reload is called
    const existing = get().machines;
    Object.keys(existing).forEach(num => {
      if (map[num]) {
        map[num] = existing[num];
      }
    });
    set({ machines: map, loaded: true, loading: false });
  },

  assignEmployeeToMachine: (machineNumber, employeeId, employeeName, location, date, time) => {
    const state = get();
    const machines = { ...state.machines };

    // Detach employee from any other machine first (no duplicates)
    Object.keys(machines).forEach(num => {
      const m = machines[num];
      if (m.assignedEmployees.includes(employeeId) && num !== machineNumber) {
        const next = m.assignedEmployees.filter(id => id !== employeeId);
        machines[num] = { ...m, assignedEmployees: next, tmpCount: next.length };
      }
    });

    // Attach to new machine
    const target = machines[machineNumber];
    if (target) {
      const next = target.assignedEmployees.includes(employeeId)
        ? target.assignedEmployees
        : [...target.assignedEmployees, employeeId];
      const attendanceCount = next.length; // each assigned employee = 1 attendance entry today
      machines[machineNumber] = {
        ...target,
        assignedEmployees: next,
        tmpCount: next.length,
        attendanceCount,
      };
    }

    // Replace any prior log for this employee/date with the new one
    const filteredLogs = state.logs.filter(l => !(l.employeeId === employeeId && l.date === date));
    const newLog: MachineLog = {
      id: `${employeeId}-${date}-${Date.now()}`,
      employeeId,
      employeeName,
      machineNumber,
      date,
      time,
      location,
    };

    set({ machines, logs: [newLog, ...filteredLogs] });

    // Fire-and-forget future API sync (mock)
    MachineService.assignMachine(newLog).catch(() => {});
    MachineService.updateTMP(machineNumber, machines[machineNumber]?.tmpCount ?? 0).catch(() => {});
  },

  getMachineForEmployee: (employeeId) => {
    const { machines } = get();
    const found = Object.values(machines).find(m => m.assignedEmployees.includes(employeeId));
    return found?.machineNumber ?? null;
  },

  getTodayLogForEmployee: (employeeId, date) => {
    return get().logs.find(l => l.employeeId === employeeId && l.date === date);
  },

  getMachineSummary: () => {
    return Object.values(get().machines);
  },
}));
