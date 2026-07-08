/**
 * SPIM Lite HR-only API wrappers.
 *
 * Every call here targets an endpoint gated by the Suite's
 * `mobile_hr_required` decorator — non-HR tokens will receive HTTP 403
 * and callers should surface that as a permission error. Kept separate
 * from services/api.ts so employee-scoped helpers stay isolated.
 */
import { apiGet, apiPost, apiPut, apiDelete } from './apiClient';

function str(v: any): string {
  if (v == null) return '';
  return String(v);
}

// ---------------------------------------------------------------------------
// HR employee list — GET /api/mobile/hr/employees/
// ---------------------------------------------------------------------------

export interface HrEmployee {
  id: string;              // employee_id (business ID, may be blank)
  pk: number;              // internal PK — always present, used as target key
  name: string;
  dept: string;
  role: string;            // designation
  mainLocation: string;
  site: string;
  baseSalary: number;
  salaryType: string;
}

// Module-level cache — the HR employee roster changes rarely (new hires,
// terminations, department reshuffles), so refetching on every screen
// mount just to power the picker is wasteful. Cache the roster once per
// app session; call clearHrEmployeeCache() on logout if a listener needs
// to invalidate it (currently unused — token clear handles the auth side).
let _hrEmployeeCache: HrEmployee[] | null = null;
let _hrEmployeeInflight: Promise<HrEmployee[]> | null = null;

export function clearHrEmployeeCache(): void {
  _hrEmployeeCache = null;
  _hrEmployeeInflight = null;
}

export async function fetchHrEmployees(
  opts: { force?: boolean } = {},
): Promise<HrEmployee[]> {
  if (!opts.force && _hrEmployeeCache) return _hrEmployeeCache;
  if (!opts.force && _hrEmployeeInflight) return _hrEmployeeInflight;

  const p = (async () => {
    const data: any = await apiGet('/api/mobile/hr/employees/');
    const list: any[] = Array.isArray(data?.employees) ? data.employees : [];
    const mapped: HrEmployee[] = list.map(e => ({
      id:           str(e.id),
      pk:           Number(e.pk ?? 0),
      name:         str(e.name),
      dept:         str(e.dept),
      role:         str(e.role),
      mainLocation: str(e.mainLocation),
      site:         str(e.site),
      baseSalary:   Number(e.baseSalary ?? 0),
      salaryType:   str(e.salaryType || 'base_salary'),
    }));
    _hrEmployeeCache = mapped;
    _hrEmployeeInflight = null;
    return mapped;
  })();
  _hrEmployeeInflight = p;
  try {
    return await p;
  } catch (err) {
    _hrEmployeeInflight = null;
    throw err;
  }
}

// ---------------------------------------------------------------------------
// HR attendance — GET /api/mobile/hr/attendance/?employee_id=<pk>&date_from=…&date_to=…
// ---------------------------------------------------------------------------

export interface HrAttendanceRecord {
  empId: string;
  empPk: number;
  empName: string;
  date: string;    // YYYY-MM-DD
  status: string;  // 'Present' | 'Absent' | 'Half Day' | 'Leave' | 'Holiday' | 'Weekly Off' | 'No Week Off' | 'Sunday'
  source: string;
  site: string;
  workingSite: string;
}

// ---------------------------------------------------------------------------
// HR salary — GET /api/mobile/hr/salary/?employee_id=<pk>
// ---------------------------------------------------------------------------
//
// Backend anchors the cycle on `date.today()` server-side; the endpoint is
// NOT cycle-dependent, so the cache key is just the employee pk.
// ---------------------------------------------------------------------------

export interface HrSalary {
  employee: {
    pk: number;
    employee_id: string;
    name: string;
  };
  salary: {
    basic_salary: string;
    hra: string;
    allowances: string;
    deductions: string;
    net_salary: string;
    paid_days: number;
    present_days: number;
    absent_days: number;
    cycle_start: string;
    cycle_end: string;
  };
}

const _hrSalaryCache = new Map<number, HrSalary>();
const _hrSalaryInflight = new Map<number, Promise<HrSalary>>();

export function clearHrSalaryCache(employeePk?: number): void {
  if (employeePk == null) {
    _hrSalaryCache.clear();
    _hrSalaryInflight.clear();
  } else {
    _hrSalaryCache.delete(employeePk);
    _hrSalaryInflight.delete(employeePk);
  }
}

export async function fetchHrSalary(
  employeePk: number,
  opts: { force?: boolean } = {},
): Promise<HrSalary> {
  if (!opts.force) {
    const cached = _hrSalaryCache.get(employeePk);
    if (cached) return cached;
    const inflight = _hrSalaryInflight.get(employeePk);
    if (inflight) return inflight;
  }

  const p = (async () => {
    const qs = new URLSearchParams({
      employee_id: String(employeePk),
    }).toString();
    const data: any = await apiGet(`/api/mobile/hr/salary/?${qs}`);
    const emp = data?.employee || {};
    const sal = data?.salary || {};
    const mapped: HrSalary = {
      employee: {
        pk:          Number(emp.pk ?? employeePk),
        employee_id: str(emp.employee_id),
        name:        str(emp.name),
      },
      salary: {
        basic_salary: str(sal.basic_salary ?? '0.00'),
        hra:          str(sal.hra          ?? '0.00'),
        allowances:   str(sal.allowances   ?? '0.00'),
        deductions:   str(sal.deductions   ?? '0.00'),
        net_salary:   str(sal.net_salary   ?? '0.00'),
        paid_days:    Number(sal.paid_days    ?? 0),
        present_days: Number(sal.present_days ?? 0),
        absent_days:  Number(sal.absent_days  ?? 0),
        cycle_start:  str(sal.cycle_start),
        cycle_end:    str(sal.cycle_end),
      },
    };
    _hrSalaryCache.set(employeePk, mapped);
    _hrSalaryInflight.delete(employeePk);
    return mapped;
  })();
  _hrSalaryInflight.set(employeePk, p);
  try {
    return await p;
  } catch (err) {
    _hrSalaryInflight.delete(employeePk);
    throw err;
  }
}

export async function fetchHrAttendance(
  employeePk: number,
  dateFrom: string,
  dateTo: string,
): Promise<HrAttendanceRecord[]> {
  const qs = new URLSearchParams({
    employee_id: String(employeePk),
    date_from:   dateFrom,
    date_to:     dateTo,
  }).toString();
  const data: any = await apiGet(`/api/mobile/hr/attendance/?${qs}`);
  const list: any[] = Array.isArray(data?.records) ? data.records : [];
  return list.map(r => ({
    empId:       str(r.empId),
    empPk:       Number(r.empPk ?? 0),
    empName:     str(r.empName),
    date:        str(r.date).slice(0, 10),
    status:      str(r.status),
    source:      str(r.source),
    site:        str(r.site),
    workingSite: str(r.workingSite),
  }));
}

// ---------------------------------------------------------------------------
// HR Income — mirrors income.views._income_to_dict verbatim so no
// serializer logic is duplicated on the client. Every field on HrIncome
// maps 1:1 with a JSON key returned by the backend.
// ---------------------------------------------------------------------------

export interface HrIncome {
  id: number;
  date: string;          // YYYY-MM-DD
  date_display: string;  // "dd MMM, YYYY"
  amount: string;        // decimal string, e.g. "1234.00"
  amount_display: string;// formatted amount, e.g. "1,234.00"
  income_type: string;
  location: string;
  payment_by: string;
  payment_mode: string;
  description: string;
  from_account: string;
  to_account: string;
  remarks: string;
}

export interface HrIncomeCategory {
  id: number;
  name: string;
}

export interface HrIncomeFilters {
  search?: string;
  category?: number | string;
  dateFrom?: string;
  dateTo?: string;
}

export interface HrIncomeInput {
  amount: string;
  date: string;
  description?: string;
  payment_mode?: string;
  income_type?: string;
  location_site?: string;
  payment_by?: string;
  from_account?: string;
  to_account?: string;
  remarks?: string;
}

function mapIncome(raw: any): HrIncome {
  return {
    id:             Number(raw?.id ?? 0),
    date:           str(raw?.date),
    date_display:   str(raw?.date_display),
    amount:         str(raw?.amount ?? '0.00'),
    amount_display: str(raw?.amount_display ?? raw?.amount ?? '0.00'),
    income_type:    str(raw?.income_type),
    location:       str(raw?.location),
    payment_by:     str(raw?.payment_by),
    payment_mode:   str(raw?.payment_mode),
    description:    str(raw?.description),
    from_account:   str(raw?.from_account),
    to_account:     str(raw?.to_account),
    remarks:        str(raw?.remarks),
  };
}

let _hrCategoryCache: HrIncomeCategory[] | null = null;

export function clearHrIncomeCategoryCache(): void {
  _hrCategoryCache = null;
}

export async function fetchHrIncomeCategories(
  opts: { force?: boolean } = {},
): Promise<HrIncomeCategory[]> {
  if (!opts.force && _hrCategoryCache) return _hrCategoryCache;
  const data: any = await apiGet('/api/mobile/hr/income/categories/');
  const list: any[] = Array.isArray(data?.categories) ? data.categories : [];
  const mapped: HrIncomeCategory[] = list.map(c => ({
    id:   Number(c?.id ?? 0),
    name: str(c?.name),
  }));
  _hrCategoryCache = mapped;
  return mapped;
}

export async function fetchHrIncomes(
  filters: HrIncomeFilters = {},
): Promise<HrIncome[]> {
  const params = new URLSearchParams();
  if (filters.search)   params.set('search',    filters.search);
  if (filters.category) params.set('category',  String(filters.category));
  if (filters.dateFrom) params.set('date_from', filters.dateFrom);
  if (filters.dateTo)   params.set('date_to',   filters.dateTo);
  const qs = params.toString();
  const path = qs ? `/api/mobile/hr/income/?${qs}` : '/api/mobile/hr/income/';
  const data: any = await apiGet(path);
  const list: any[] = Array.isArray(data?.incomes) ? data.incomes : [];
  return list.map(mapIncome);
}

export async function fetchHrIncome(pk: number): Promise<HrIncome> {
  const data: any = await apiGet(`/api/mobile/hr/income/${pk}/`);
  return mapIncome(data?.income ?? data);
}

export async function createHrIncome(input: HrIncomeInput): Promise<HrIncome> {
  const data: any = await apiPost('/api/mobile/hr/income/', input);
  return mapIncome(data?.income ?? data);
}

export async function updateHrIncome(
  pk: number,
  input: HrIncomeInput,
): Promise<HrIncome> {
  const data: any = await apiPut(`/api/mobile/hr/income/${pk}/`, input);
  return mapIncome(data?.income ?? data);
}

export async function deleteHrIncome(pk: number): Promise<void> {
  await apiDelete(`/api/mobile/hr/income/${pk}/`);
}
