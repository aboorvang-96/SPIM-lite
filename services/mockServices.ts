import { apiClient } from './api';

export const AuthService = {
  login: async (employeeId: string, pin: string) => {
    // Future integration
    // return apiClient.post('/auth/login', { employeeId, pin });
    return new Promise(resolve => setTimeout(() => resolve({ token: 'mock-token', userId: employeeId }), 1000));
  },
  logout: async () => {
    // Future integration
    // return apiClient.post('/auth/logout');
    return Promise.resolve();
  }
};

export const EmployeeService = {
  getProfile: async (employeeId: string) => {
    // return apiClient.get(`/employee/${employeeId}`);
    return Promise.resolve({ id: employeeId });
  },
  updateProfile: async (employeeId: string, data: any) => {
    // return apiClient.put(`/employee/${employeeId}`, data);
    return Promise.resolve(true);
  }
};

export const AttendanceService = {
  markPresent: async (employeeId: string, date: string) => {
    // return apiClient.post('/attendance/mark', { employeeId, date });
    return Promise.resolve(true);
  }
};

export const SalaryService = {
  getSalaryDetails: async (employeeId: string, month: string) => {
    // return apiClient.get(`/salary/${employeeId}`, { params: { month } });
    return Promise.resolve({});
  }
};
