import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

/**
 * Base URL of the SPIM Suite Django backend.
 *
 * Resolution order:
 *   1. EXPO_PUBLIC_API_URL build-time env var (wins on every platform).
 *   2. Platform-aware default:
 *        - web      -> http://127.0.0.1:8000  (browser loopback)
 *        - android  -> http://10.0.2.2:8000   (Android emulator host loopback)
 *        - ios      -> http://localhost:8000  (iOS simulator host loopback)
 *
 * For a physical device on the same LAN, set EXPO_PUBLIC_API_URL explicitly:
 *   EXPO_PUBLIC_API_URL=http://192.168.1.20:8000 npx expo start
 */
function resolveBaseUrl(): string {
  const envUrl = process.env.EXPO_PUBLIC_API_URL as string | undefined;
  if (envUrl && envUrl.trim()) return envUrl.trim();
  if (Platform.OS === 'android') return 'http://10.0.2.2:8000';
  // 'web', 'ios', and anything else use the standard loopback.
  return 'http://127.0.0.1:8000';
}

export const API_BASE_URL = resolveBaseUrl();

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use(
  async (config) => {
    const token = await AsyncStorage.getItem('mobile_auth_token');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

apiClient.interceptors.response.use(
  (response) => response,
  (error) => Promise.reject(error),
);

// ---------------------------------------------------------------------------
// SPIM Lite mobile auth endpoints
// ---------------------------------------------------------------------------

export interface MobileEmployee {
  id: number;
  employee_id: string;
  login_id: string;
  name: string;
  designation: string;
  department: string;
  location: string;
  site: string;
}

export interface MobileLoginResponse {
  success: boolean;
  token?: string;
  password_reset_required?: boolean;
  employee?: MobileEmployee;
  error?: string;
  message?: string;
}

/**
 * Authenticate against SPIM Suite. The backend accepts either employee_login_id
 * or the legacy employee_id under the "login_id" key.
 */
export async function mobileLogin(
  employeeId: string,
  password: string,
  deviceInfo?: string,
): Promise<MobileLoginResponse> {
  try {
    const resp = await apiClient.post<MobileLoginResponse>('/api/mobile/login/', {
      login_id: employeeId,
      password,
      device_info: deviceInfo ?? '',
    });
    return resp.data;
  } catch (err: any) {
    if (err?.response?.data) {
      return err.response.data as MobileLoginResponse;
    }
    // Network-level failure (timeout, CORS, DNS, server down). Surface the
    // backend URL we tried so the user/dev can spot misconfiguration.
    const reason = err?.message || 'Network error';
    return { success: false, error: `${reason} (server: ${API_BASE_URL})` };
  }
}

export async function mobileLogout(): Promise<void> {
  try {
    await apiClient.post('/api/mobile/logout/');
  } catch {
    // Server-side revocation is best-effort; local token is cleared regardless.
  }
}

// ---------------------------------------------------------------------------
// SPIM Lite data endpoints (all scoped server-side to the authenticated
// employee — no employee id parameter is ever sent from the client).
// ---------------------------------------------------------------------------

export interface MobileProfileResponse {
  success: boolean;
  profile?: {
    id: number;
    employee_id: string;
    login_id: string;
    name: string;
    designation: string;
    department: string;
    location: string;
    site: string;
    level: string;
    mobile: string;
    branch: string;
    base_salary: string;
    fixed_allowance: string;
    joining_date: string | null;
    status: string;
    job_role: { name: string; salary_type: string; base_salary: string } | null;
    bank: {
      bank_name: string; account_holder: string; account_number: string;
      ifsc_code: string; branch: string;
    } | null;
    pf: {
      pf_number: string; uan_number: string; esic_number: string;
      employee_contribution: string; employer_contribution: string;
    } | null;
    latest_salary: {
      month: string; basic_salary: string; extra_allowance: string;
      ot_allowance: string; advance_pay: string; total_deduction: string;
      food_allowance: string; food_usage: string;
      pf_employee: string; pf_employer: string; net_pay: string;
    } | null;
    attendance_summary: {
      month: string; present: number; half_day: number; absent: number; leave: number;
    };
    // Company details for the SPIM Lite dashboard. Sourced from the
    // Suite's dashboard.CompanySettings model via mobile_profile. Any
    // individual field may be an empty string — the UI hides those.
    company?: {
      name: string;
      logo_url: string;
      address: string;
      contact_number: string;
      email: string;
      gst_number: string;
      managing_director: string;
    } | null;
  };
  error?: string;
}

export interface MobileAttendanceRecord {
  id: number;
  date: string;
  status: 'present' | 'absent' | 'half_day' | 'leave';
  source: string;
}

export interface MobilePayslip {
  id: number;
  is_generated: boolean;
  generated_at: string | null;
  month: string;
  basic_salary: string;
  ot_allowance: string;
  advance_pay: string;
  total_deduction: string;
  food_allowance: string;
  food_usage: string;
  net_pay: string;
}

export interface MobileWorklog {
  id: number;
  date: string;
  location: string;
  site: string;
  work_details: string;
  remarks: string;
}

export interface MobileMachine { id: number; machine_no: string; }

export async function fetchProfile(): Promise<MobileProfileResponse> {
  const resp = await apiClient.get<MobileProfileResponse>('/api/mobile/profile/');
  return resp.data;
}

export async function fetchAttendance(month?: string): Promise<MobileAttendanceRecord[]> {
  const params = month ? { month } : undefined;
  const resp = await apiClient.get<{ success: boolean; attendance: MobileAttendanceRecord[] }>(
    '/api/mobile/attendance/', { params },
  );
  return resp.data?.attendance ?? [];
}

export async function postAttendance(
  status: 'present' | 'absent' | 'half_day' | 'leave',
  dateISO?: string,
): Promise<MobileAttendanceRecord> {
  const resp = await apiClient.post<{ success: boolean; record: MobileAttendanceRecord; error?: string }>(
    '/api/mobile/attendance/',
    { status, date: dateISO },
  );
  if (!resp.data?.success || !resp.data.record) {
    throw new Error(resp.data?.error || 'Failed to mark attendance');
  }
  return resp.data.record;
}

export async function fetchPayslips(): Promise<MobilePayslip[]> {
  const resp = await apiClient.get<{ success: boolean; payslips: MobilePayslip[] }>(
    '/api/mobile/payslips/',
  );
  return resp.data?.payslips ?? [];
}

export async function fetchWorklogs(): Promise<MobileWorklog[]> {
  const resp = await apiClient.get<{ success: boolean; worklogs: MobileWorklog[] }>(
    '/api/mobile/worklogs/',
  );
  return resp.data?.worklogs ?? [];
}

export interface PostWorklogInput {
  machine_no: string;
  status?: string;
  remarks?: string;
  tmp?: number;
  date?: string;
}

export async function postWorklog(input: PostWorklogInput): Promise<MobileWorklog> {
  const resp = await apiClient.post<{ success: boolean; worklog: MobileWorklog; error?: string }>(
    '/api/mobile/worklogs/',
    input,
  );
  if (!resp.data?.success || !resp.data.worklog) {
    throw new Error(resp.data?.error || 'Failed to save machine log');
  }
  return resp.data.worklog;
}

export async function fetchMachines(): Promise<MobileMachine[]> {
  const resp = await apiClient.get<{ success: boolean; machines: MobileMachine[] }>(
    '/api/mobile/machines/',
  );
  return resp.data?.machines ?? [];
}

export interface MobileBankDetails {
  bank_name: string;
  account_holder: string;
  account_number: string;
  ifsc_code: string;
  branch: string;
  status: string;
}

export async function fetchBankDetails(): Promise<MobileBankDetails> {
  const resp = await apiClient.get<{ success: boolean; bank: MobileBankDetails }>(
    '/api/mobile/bank-details/',
  );
  return resp.data.bank;
}

export async function updateBankDetails(updates: Partial<MobileBankDetails>): Promise<MobileBankDetails> {
  const resp = await apiClient.post<{ success: boolean; bank: MobileBankDetails }>(
    '/api/mobile/bank-details/',
    updates,
  );
  return resp.data.bank;
}

/**
 * Absolute URL for a payslip download (HTML — user can use the browser's
 * print-to-PDF). The bearer token is appended as a query string because
 * Linking.openURL / browser tabs cannot set the Authorization header.
 * The backend's _extract_token() honours this query param.
 */
export async function payslipDownloadUrl(payslipId: number): Promise<string> {
  const token = await AsyncStorage.getItem('mobile_auth_token');
  const q = token ? `?token=${encodeURIComponent(token)}` : '';
  return `${API_BASE_URL}/api/mobile/payslips/${payslipId}/download/${q}`;
}
