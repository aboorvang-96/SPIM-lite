import { create } from 'zustand';
import { format } from 'date-fns';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  Machine,
  MachineLog,
  MachineStatus,
  DEFAULT_MACHINE_STATUSES,
} from '../types';
import { MachineService } from '../services/machineService';

/**
 * Machine store.
 *
 * Mobile Machine Log module state:
 *  - machineList       : machine numbers loaded from the service layer
 *  - logs              : per-employee daily machine work logs
 *  - statusList        : statuses available in the Status dropdown
 *                        (defaults + employee-added, persisted in AsyncStorage)
 *  - selectedMachine   : current form selection
 *  - status            : current form selection
 *  - remarks           : current form text
 *  - date              : current form date (today, read-only in UI)
 */
interface MachineState {
  machineList: Machine[];
  loaded: boolean;
  loading: boolean;

  logs: MachineLog[];

  statusList: MachineStatus[];
  statusLoaded: boolean;

  // Transient form state
  selectedMachine: string | null;
  status: MachineStatus | null;
  remarks: string;
  date: string;

  loadMachines: () => Promise<void>;

  setSelectedMachine: (machineNo: string | null) => void;
  setStatus: (status: MachineStatus | null) => void;
  setRemarks: (remarks: string) => void;
  resetForm: () => void;

  saveLog: (employeeId: string) => Promise<boolean>;

  getTodayLogForEmployee: (employeeId: string) => MachineLog | undefined;

  /**
   * Back-compat helper used by attendance / dashboard chips.
   * Returns the machine number this employee logged for today, or null.
   */
  getMachineForEmployee: (employeeId: string) => string | null;

  // --- Status list management ----------------------------------------------
  getStatusList: () => MachineStatus[];
  loadStatus: () => Promise<void>;
  saveStatus: () => Promise<void>;
  /** Returns true on success, false if empty or duplicate. */
  addStatus: (name: string) => Promise<boolean>;
}

const todayISO = () => format(new Date(), 'yyyy-MM-dd');

const STATUS_STORAGE_KEY = '@spim-lite/machine-status-list/v1';

export const useMachineStore = create<MachineState>((set, get) => ({
  machineList: [],
  loaded: false,
  loading: false,

  logs: [],

  statusList: DEFAULT_MACHINE_STATUSES.slice(),
  statusLoaded: false,

  selectedMachine: null,
  status: null,
  remarks: '',
  date: todayISO(),

  loadMachines: async () => {
    if (get().loaded || get().loading) return;
    set({ loading: true });
    try {
      const list = await MachineService.getMachines();
      set({ machineList: list, loaded: true, loading: false });
    } catch {
      set({ loading: false });
    }
  },

  setSelectedMachine: (machineNo) => set({ selectedMachine: machineNo }),
  setStatus: (status) => set({ status }),
  setRemarks: (remarks) => set({ remarks }),

  resetForm: () => set({
    selectedMachine: null,
    status: null,
    remarks: '',
    date: todayISO(),
  }),

  saveLog: async (employeeId) => {
    const { selectedMachine, status, remarks, logs } = get();
    const date = todayISO();
    if (!selectedMachine || !status) return false;

    const newLog: MachineLog = {
      employeeId,
      machineNo: selectedMachine,
      date,
      status,
      remarks: remarks.trim(),
    };

    // Replace any prior log for this employee on the same date
    const filtered = logs.filter(l => !(l.employeeId === employeeId && l.date === date));
    set({ logs: [newLog, ...filtered], date });

    // Fire-and-forget future SPIM Suite sync
    MachineService.saveMachineLog(newLog).catch(() => {});

    return true;
  },

  getTodayLogForEmployee: (employeeId) => {
    const date = todayISO();
    return get().logs.find(l => l.employeeId === employeeId && l.date === date);
  },

  getMachineForEmployee: (employeeId) => {
    const date = todayISO();
    const found = get().logs.find(l => l.employeeId === employeeId && l.date === date);
    return found?.machineNo ?? null;
  },

  // --- Status list management ----------------------------------------------

  getStatusList: () => get().statusList,

  loadStatus: async () => {
    if (get().statusLoaded) return;
    try {
      const raw = await AsyncStorage.getItem(STATUS_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.every(s => typeof s === 'string')) {
          // Merge persisted list with defaults so newly-shipped defaults
          // always show even if user previously persisted an older list.
          const merged: string[] = [...DEFAULT_MACHINE_STATUSES];
          for (const s of parsed) {
            const trimmed = s.trim();
            if (trimmed && !merged.some(m => m.toLowerCase() === trimmed.toLowerCase())) {
              merged.push(trimmed);
            }
          }
          set({ statusList: merged, statusLoaded: true });
          return;
        }
      }
    } catch {
      /* fall through to defaults */
    }
    set({ statusLoaded: true });
  },

  saveStatus: async () => {
    try {
      await AsyncStorage.setItem(STATUS_STORAGE_KEY, JSON.stringify(get().statusList));
    } catch {
      /* best effort — UI already updated optimistically */
    }
  },

  addStatus: async (name) => {
    const trimmed = (name ?? '').trim();
    if (!trimmed) return false;
    const existing = get().statusList;
    if (existing.some(s => s.toLowerCase() === trimmed.toLowerCase())) return false;
    const next = [...existing, trimmed];
    set({ statusList: next });
    await get().saveStatus();
    return true;
  },
}));
