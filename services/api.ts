/**
 * SPIM Lite data layer — SPIM Suite REST edition.
 *
 * All exports preserve the same name and return shapes used by stores/screens
 * so nothing outside this file needs to change. Every call is proxied through
 * the shared apiClient (services/apiClient.ts), which injects the bearer
 * token from AsyncStorage and clears it on 401.
 *
 * Endpoint base: /api/mobile/  (see apiClient.ts for host configuration)
 */
import { apiGet, apiPost, ApiError } from './apiClient';
import { Platform } from 'react-native';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build an error message from anything (ApiError / Error / string). */
function asMsg(err: any, fallback: string): string {
  if (!err) return fallback;
  if (typeof err === 'string') return err;
  return err?.message || err?.error || err?.detail || fallback;
}

/** YYYY-MM-DD for "today" in the device's local time zone. */
function todayISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

/** Convert numeric column -> string ("12345.00") to keep response shape stable. */
function num2(v: any): string {
  if (v == null || v === '') return '0';
  const n = typeof v === 'number' ? v : Number(v);
  if (Number.isNaN(n)) return String(v);
  return n.toFixed(2);
}

/** Coerce a value to string, treating null/undefined as ''. */
function str(v: any): string {
  if (v == null) return '';
  return String(v);
}

// ---------------------------------------------------------------------------
// Auth
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
  // Backend login response also carries these; surfacing them here lets
  // login.tsx populate the Employee record without waiting for /profile/.
  // Notably `level` is one of the fields isHrUser() scans, so persisting
  // it at login time prevents a brief non-HR window right after sign-in.
  level: string;
  mobile: string;
  branch: string;
  base_salary: string;
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
 * POST /api/mobile/login/
 *
 * Body: { login_id, password }
 * The orgCode parameter is preserved to keep the screen-side signature
 * identical. If the backend supports org-scoped login it is sent through as
 * `org_code`; otherwise the server simply ignores the extra field.
 */
export async function mobileLogin(
  employeeId: string,
  password: string,
  orgCode: string,
  _deviceInfo?: string,
): Promise<MobileLoginResponse> {
  // Bounded timeout + one silent retry on network-level failure (status 0).
  // Guards the pre-auth call against transient TCP/DNS blips and Railway
  // cold-start hiccups that otherwise surface as "Network request failed".
  // Real HTTP errors (4xx/5xx) are NOT retried — they fall straight through.
  const doPost = () =>
    apiPost(
      '/api/mobile/login/',
      { login_id: employeeId, password, org_code: orgCode },
      { skipAuth: true, timeoutMs: 30000 },
    );
  try {
    let data: any;
    try {
      data = await doPost();
    } catch (err: any) {
      if (err instanceof ApiError && err.status === 0) {
        data = await doPost();
      } else {
        throw err;
      }
    }

    const token: string | undefined = data?.token || data?.access || data?.access_token;
    const emp = data?.employee || data?.user || null;
    if (!token || !emp) {
      return {
        success: false,
        error: data?.error || data?.message || 'Invalid credentials.',
      };
    }

    return {
      success: true,
      token,
      password_reset_required: !!(
        data?.password_reset_required ?? emp?.password_reset_required
      ),
      employee: {
        id:           Number(emp.id ?? 0),
        employee_id:  str(emp.employee_id ?? emp.id ?? ''),
        login_id:     str(emp.login_id ?? emp.employee_login_id ?? employeeId),
        name:         str(emp.name),
        designation:  str(emp.designation),
        department:   str(emp.department),
        location:     str(emp.location),
        site:         str(emp.site),
        level:        str(emp.level),
        mobile:       str(emp.mobile),
        branch:       str(emp.branch),
        base_salary:  str(emp.base_salary),
      },
    };
  } catch (err: any) {
    if (err instanceof ApiError) {
      return { success: false, error: asMsg(err.body || err, 'Invalid credentials.') };
    }
    return { success: false, error: asMsg(err, 'Login failed. Please try again.') };
  }
}

/**
 * POST /api/mobile/logout/
 *
 * Server-side token invalidation is best-effort — we always succeed locally
 * so the user can sign out even when offline.
 */
export async function mobileLogout(): Promise<void> {
  try {
    await apiPost('/api/mobile/logout/', {}, { skipAuthRedirect: true });
  } catch {
    // Local session is cleared regardless; surface nothing.
  }
}

// ---------------------------------------------------------------------------
// Profile (GET /api/mobile/profile/)
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

export async function fetchProfile(): Promise<MobileProfileResponse> {
  try {
    const data: any = await apiGet('/api/mobile/profile/');
    const raw = data?.profile || data;

    const job = raw?.job_role || null;
    const bank = raw?.bank || null;
    const pf = raw?.pf || null;
    const sal = raw?.latest_salary || null;
    const att = raw?.attendance_summary || {};
    const company = raw?.company || null;

    return {
      success: true,
      profile: {
        id:               Number(raw?.id ?? 0),
        employee_id:      str(raw?.employee_id),
        login_id:         str(raw?.login_id ?? raw?.employee_login_id),
        name:             str(raw?.name),
        designation:      str(raw?.designation),
        department:       str(raw?.department),
        location:         str(raw?.location),
        site:             str(raw?.site),
        level:            str(raw?.level),
        mobile:           str(raw?.mobile),
        branch:           str(raw?.branch),
        base_salary:      num2(raw?.base_salary),
        fixed_allowance:  num2(raw?.fixed_allowance),
        joining_date:     raw?.joining_date ?? null,
        status:           str(raw?.status || 'active'),
        job_role: job
          ? {
              name:        str(job.name),
              salary_type: str(job.salary_type),
              base_salary: num2(job.base_salary),
            }
          : null,
        bank: bank
          ? {
              bank_name:      str(bank.bank_name),
              account_holder: str(bank.account_holder),
              account_number: str(bank.account_number),
              ifsc_code:      str(bank.ifsc_code),
              branch:         str(bank.branch),
            }
          : null,
        pf: pf
          ? {
              pf_number:             str(pf.pf_number),
              uan_number:            str(pf.uan_number),
              esic_number:           str(pf.esic_number),
              employee_contribution: num2(pf.employee_contribution),
              employer_contribution: num2(pf.employer_contribution),
            }
          : null,
        latest_salary: sal
          ? {
              month:           str(sal.month).slice(0, 7),
              basic_salary:    num2(sal.basic_salary),
              extra_allowance: num2(sal.extra_allowance),
              ot_allowance:    num2(sal.ot_allowance),
              advance_pay:     num2(sal.advance_pay),
              total_deduction: num2(sal.total_deduction),
              food_allowance:  num2(sal.food_allowance),
              food_usage:      num2(sal.food_usage),
              pf_employee:     num2(sal.pf_employee ?? sal.pf_employee_snapshot),
              pf_employer:     num2(sal.pf_employer ?? sal.pf_employer_snapshot),
              net_pay:         num2(sal.net_pay),
            }
          : null,
        attendance_summary: {
          month:    str(att.month),
          present:  Number(att.present ?? 0),
          half_day: Number(att.half_day ?? 0),
          absent:   Number(att.absent ?? 0),
          leave:    Number(att.leave ?? 0),
        },
        company: company
          ? {
              name:              str(company.name),
              logo_url:          str(company.logo_url ?? company.logo),
              address:           str(company.address),
              contact_number:    str(company.contact_number),
              email:             str(company.email),
              gst_number:        str(company.gst_number),
              managing_director: str(company.managing_director),
            }
          : null,
      },
    };
  } catch (err: any) {
    return { success: false, error: asMsg(err, 'Could not load profile.') };
  }
}

// ---------------------------------------------------------------------------
// Attendance
// ---------------------------------------------------------------------------

export interface MobileAttendanceRecord {
  id: number;
  date: string;
  // Suite's raw wire status. Widened to accept the full display_status()
  // set (including 'sunday') so nothing forces a client-side re-mapping.
  status: 'present' | 'absent' | 'half_day' | 'leave' | 'week_off' | 'no_week_off' | 'holiday' | 'sunday';
  source: string;
  /** Server-side lock flag — employee may not re-mark when true. */
  locked?: boolean;
  site?: string;
  working_site?: string;
}

export async function fetchAttendance(month?: string): Promise<MobileAttendanceRecord[]> {
  const qs = month ? `?month=${encodeURIComponent(month)}` : '';
  const data: any = await apiGet(`/api/mobile/attendance/${qs}`);
  const list: any[] = Array.isArray(data) ? data : data?.attendance || data?.records || data?.results || [];
  return list
    // 'sunday' is a first-class label from Suite's display_status() /
    // ensure_sunday_holidays(); passing it through prevents the mobile
    // client from having to synthesise "Sunday" on missing dates.
    .filter(r => ['present', 'absent', 'half_day', 'leave', 'week_off', 'no_week_off', 'holiday', 'sunday'].includes(r.status))
    .map(r => ({
      id:     Number(r.id),
      date:   str(r.date).slice(0, 10),
      status: r.status as MobileAttendanceRecord['status'],
      source: str(r.source),
      locked: !!r.locked,
      site:         r.site != null ? str(r.site) : undefined,
      working_site: r.working_site != null ? str(r.working_site) : undefined,
    }));
}

// ---------------------------------------------------------------------------
// Payslips / salary (GET /api/mobile/payslips/)
// ---------------------------------------------------------------------------

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
  // Suite-computed flags. SPIM Lite must not derive these — see
  // api.mobile_payslips docstring in SPIM Suite.
  is_current_cycle?: boolean;
  is_latest_generated?: boolean;
}

export interface MobilePayslipsResponse {
  payslips: MobilePayslip[];
  /** Suite-picked payslip id: current-cycle if generated, else latest generated. */
  currentPayslipId: number | null;
}

export async function fetchPayslips(): Promise<MobilePayslipsResponse> {
  const data: any = await apiGet('/api/mobile/payslips/');
  const list: any[] = Array.isArray(data) ? data : data?.payslips || data?.results || [];
  const payslips = list.map(r => ({
    id:                  Number(r.id),
    is_generated:        !!(r.is_generated ?? r.is_payslip_generated),
    generated_at:        r.generated_at ?? r.payslip_generated_at ?? null,
    month:               str(r.month).slice(0, 7),
    basic_salary:        num2(r.basic_salary),
    ot_allowance:        num2(r.ot_allowance),
    advance_pay:         num2(r.advance_pay),
    total_deduction:     num2(r.total_deduction),
    food_allowance:      num2(r.food_allowance),
    food_usage:          num2(r.food_usage),
    net_pay:             num2(r.net_pay),
    is_current_cycle:    !!r.is_current_cycle,
    is_latest_generated: !!r.is_latest_generated,
  }));
  const rawId = data?.current_payslip_id;
  const currentPayslipId =
    rawId === undefined || rawId === null ? null : Number(rawId);
  return { payslips, currentPayslipId };
}

// ---------------------------------------------------------------------------
// Salary cycle summary (GET /api/mobile/salary/)
// ---------------------------------------------------------------------------

export async function fetchSalary(): Promise<any> {
  // -- TEMPORARY DEBUG INSTRUMENTATION (regression triage). Remove
  // this whole block once the failure point is identified.
  const _dbgUrl = `${API_BASE_URL}/api/mobile/salary/`;
  console.log('[FETCH_SALARY_REQ]', _dbgUrl);
  try {
    // Duplicate low-level fetch so we can see the raw body + status
    // BEFORE apiGet parses / throws. If this network path itself fails,
    // apiGet will re-throw and land in the catch below with the same
    // error — the diagnostic log runs first either way.
    let _dbgStatus: number | null = null;
    let _dbgRawBody: string = '';
    try {
      const { apiFetch } = await import('./apiClient');
      const _dbgRes = await apiFetch('/api/mobile/salary/', { method: 'GET' });
      _dbgStatus  = _dbgRes.status;
      _dbgRawBody = await _dbgRes.clone().text();
      console.log('[FETCH_SALARY_HTTP]', _dbgStatus, 'bodyLen=', _dbgRawBody.length);
      console.log('[FETCH_SALARY_RAW]',  _dbgRawBody.slice(0, 2000));
    } catch (_probeErr: any) {
      console.log('[FETCH_SALARY_PROBE_FAIL]', _probeErr?.name, _probeErr?.message);
    }

    const data: any = await apiGet('/api/mobile/salary/');
    console.log('[FETCH_SALARY_PARSED]', JSON.stringify(data).slice(0, 2000));
    const sal = data?.salary || data;
    // Zero fallbacks. Every field is a raw pass-through: if SPIM Suite
    // omits it, the value stays `undefined` through the store and the UI
    // renders "—" so a missing backend field is visible to the user.
    // No `?? '0.00'`, no `?? 0`, no client-side substitute.
    const optStr = (v: any): string | undefined =>
      v === undefined || v === null ? undefined : String(v);
    const optNum = (v: any): number | undefined => {
      if (v === undefined || v === null || v === '') return undefined;
      const n = typeof v === 'number' ? v : Number(v);
      return Number.isFinite(n) ? n : undefined;
    };
    const _out = {
      success: true,
      salary: {
        net_salary:          optStr(sal.net_salary),
        basic_salary:        optStr(sal.basic_salary),
        allowances:          optStr(sal.allowances),
        deductions:          optStr(sal.deductions),
        paid_days:           optNum(sal.paid_days),
        present_days:        optNum(sal.present_days),
        absent_days:         optNum(sal.absent_days),
        cycle_start:         optStr(sal.cycle_start),
        cycle_end:           optStr(sal.cycle_end),
        attendance_earnings: optStr(sal.attendance_earnings),
        daily_rate:          optStr(sal.daily_rate),
        total_working_days:  optNum(sal.total_working_days),
        advance_deduction:   optStr(sal.advance_deduction),
        food_allowance:      optStr(sal.food_allowance),
        // No fallback to legacy `allowances`. Suite must expose
        // `overtime_allowance` as its own field.
        overtime_allowance:  optStr(sal.overtime_allowance),
      },
    };
    // -- TEMPORARY DEBUG: dump the post-parse payload the store will
    // receive. If any numeric field is undefined here it's because the
    // matching backend field was null / '' / non-numeric.
    console.log('[FETCH_SALARY_OUT]', JSON.stringify(_out));
    return _out;
  } catch (err: any) {
    // -- TEMPORARY DEBUG: full error surface for triage.
    console.log(
      '[FETCH_SALARY_ERR]',
      'name=', err?.name,
      'status=', err?.status,
      'message=', err?.message,
      'body=', typeof err?.body === 'string' ? err.body.slice(0, 500) : err?.body,
      'stack=', (err?.stack || '').split('\n').slice(0, 6).join(' | '),
    );
    return { success: false, error: err?.message || 'Failed' };
  }
}

// ---------------------------------------------------------------------------
// Worklogs (GET/POST /api/mobile/worklogs/)
// ---------------------------------------------------------------------------

export interface MobileWorklog {
  id: number;
  date: string;
  location: string;
  site: string;
  work_details: string;
  remarks: string;
}

export async function fetchWorklogs(): Promise<MobileWorklog[]> {
  const data: any = await apiGet('/api/mobile/worklogs/');
  const list: any[] = Array.isArray(data) ? data : data?.worklogs || data?.results || [];
  return list.map(w => ({
    id:           Number(w.id),
    date:         str(w.date),
    location:     str(
      typeof w.location === 'object' && w.location !== null
        ? w.location.name
        : (w.location ?? w.machine_no),
    ),
    site:         str(w.site),
    work_details: str(w.work_details ?? w.status ?? ''),
    remarks:      str(w.remarks),
  }));
}

export interface PostWorklogInput {
  machine_no: string;
  status?: string;
  remarks?: string;
  tmp?: number;
  date?: string;
}

export async function postWorklog(input: PostWorklogInput): Promise<MobileWorklog> {
  const machineName = (input.machine_no || '').trim();
  if (!machineName) throw new Error('Machine number is required.');
  const date = input.date || todayISO();

  const data: any = await apiPost('/api/mobile/worklogs/', {
    machine_no:   machineName,
    date,
    status:       input.status || '',
    work_details: input.status || '',
    remarks:      input.remarks || '',
    tmp:          input.tmp ?? 0,
  });
  const w = data?.worklog || data?.record || data;

  return {
    id:           Number(w?.id ?? 0),
    date:         str(w?.date ?? date),
    location:     str(
      typeof w?.location === 'object' && w?.location !== null
        ? w.location.name
        : (w?.location ?? machineName),
    ),
    site:         str(w?.site),
    work_details: str(w?.work_details ?? input.status ?? ''),
    remarks:      str(w?.remarks ?? input.remarks ?? ''),
  };
}

// ---------------------------------------------------------------------------
// Machines (GET /api/mobile/machines/)
// ---------------------------------------------------------------------------

export interface MobileMachine { id: number; machine_no: string; }

export async function fetchMachines(): Promise<MobileMachine[]> {
  const data: any = await apiGet('/api/mobile/machines/');
  const list: any[] = Array.isArray(data) ? data : data?.machines || data?.results || [];
  return list.map(m => ({
    id:         Number(m.id),
    machine_no: str(m.machine_no ?? m.name),
  }));
}

// ---------------------------------------------------------------------------
// Bank details (GET/POST /api/mobile/bank-details/)
// ---------------------------------------------------------------------------

export interface MobileBankDetails {
  bank_name: string;
  account_holder: string;
  account_number: string;
  ifsc_code: string;
  branch: string;
  status: string;
}

const EMPTY_BANK: MobileBankDetails = {
  bank_name: '', account_holder: '', account_number: '',
  ifsc_code: '', branch: '', status: 'pending',
};

function normaliseBank(raw: any): MobileBankDetails {
  if (!raw) return { ...EMPTY_BANK };
  return {
    bank_name:      str(raw.bank_name),
    account_holder: str(raw.account_holder),
    account_number: str(raw.account_number),
    ifsc_code:      str(raw.ifsc_code),
    branch:         str(raw.branch),
    status:         str(raw.status || 'pending'),
  };
}

export async function fetchBankDetails(): Promise<MobileBankDetails> {
  try {
    const data: any = await apiGet('/api/mobile/bank-details/');
    const raw = data?.bank || data?.bank_details || data;
    return normaliseBank(raw);
  } catch (err: any) {
    if (err instanceof ApiError && err.status === 404) {
      return { ...EMPTY_BANK };
    }
    throw new Error(asMsg(err, 'Could not load bank details.'));
  }
}

export async function updateBankDetails(
  updates: Partial<MobileBankDetails>,
): Promise<MobileBankDetails> {
  const payload = {
    bank_name:      updates.bank_name      ?? '',
    account_holder: updates.account_holder ?? '',
    account_number: updates.account_number ?? '',
    ifsc_code:      updates.ifsc_code      ?? '',
    branch:         updates.branch         ?? '',
  };
  const data: any = await apiPost('/api/mobile/bank-details/', payload);
  const raw = data?.bank || data?.bank_details || data;
  return normaliseBank(raw);
}

// ---------------------------------------------------------------------------
// Payslip download — GET /api/mobile/payslips/<id>/download/
// Returns a fully-qualified URL (or a server-provided signed URL) suitable
// for handing off to Linking.openURL / WebBrowser.openBrowserAsync.
// ---------------------------------------------------------------------------

import { API_BASE_URL } from './apiClient';

export async function payslipDownloadUrl(payslipId: number): Promise<string> {
  // Try to fetch a signed/redirect URL from the server first; if the endpoint
  // returns JSON with a URL field, use that. Otherwise hand back the direct
  // streamed-download URL — callers open it in the device browser which
  // automatically attaches the saved cookie/token via the OS.
  try {
    const data: any = await apiGet(`/api/mobile/payslips/${payslipId}/download/`);
    const url =
      data?.url ||
      data?.download_url ||
      data?.signed_url ||
      data?.signedUrl;
    if (url && typeof url === 'string') return url;
  } catch (err: any) {
    if (err instanceof ApiError && err.status !== 404) {
      // Non-404 errors are surfaced; 404 falls through to direct URL below.
      throw new Error(asMsg(err, 'Payslip is not available for download yet.'));
    }
  }
  return `${API_BASE_URL}/api/mobile/payslips/${payslipId}/download/`;
}

// ---------------------------------------------------------------------------
// Legacy export — prevents TS from tree-shaking a stale Platform import
// if platform-specific behaviour is re-added later.
// ---------------------------------------------------------------------------
void Platform;
