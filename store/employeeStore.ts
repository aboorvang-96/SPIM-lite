import { create } from 'zustand';
import { Employee } from '../types';

interface EmployeeState {
  employee: Employee | null;
  setEmployee: (employee: Employee) => void;
  updateProfile: (updates: Partial<Employee>) => void;
}

const mockEmployee: Employee = {
  id: 'EMP1024',
  name: 'John Doe',
  role: 'Site Engineer',
  level: 'L3',
  department: 'Operations',
  site: 'Project Alpha - North Wing',
  mobile: '+1 234 567 8900',
  email: 'john.doe@spim.com',
  address: '123 Main St, Cityville',
  emergencyContact: '+1 987 654 3210',
  bankDetails: 'Bank of America - XXXX1234',
  pfNumber: 'PF987654321',
  joiningDate: '2023-01-15',
};

export const useEmployeeStore = create<EmployeeState>((set) => ({
  employee: mockEmployee,
  setEmployee: (employee) => set({ employee }),
  updateProfile: (updates) => set((state) => ({
    employee: state.employee ? { ...state.employee, ...updates } : null
  })),
}));
