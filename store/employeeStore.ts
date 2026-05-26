import { create } from 'zustand';
import { Employee } from '../types';
import { fetchProfile } from '../services/api';

interface EmployeeState {
  employee: Employee | null;
  loading: boolean;
  /**
   * Populated when the most recent refresh() failed (network down, CORS,
   * 401, etc.). Cleared on success or on the next refresh attempt. Screens
   * use this to break out of infinite "Loading…" state and offer a retry.
   */
  error: string | null;
  setEmployee: (employee: Employee) => void;
  updateProfile: (updates: Partial<Employee>) => void;
  /** Pull full profile from SPIM Suite and overwrite local state. */
  refresh: () => Promise<void>;
  clear: () => void;
}

/**
 * Employee profile is populated on successful login (from the login API
 * response) and can be refreshed against /api/mobile/profile/ to fetch the
 * full record including bank/PF/payslip/attendance summary.
 */
export const useEmployeeStore = create<EmployeeState>((set, get) => ({
  employee: null,
  loading:  false,
  error:    null,
  setEmployee: (employee) => set({ employee, error: null }),
  updateProfile: (updates) => set((state) => ({
    employee: state.employee ? { ...state.employee, ...updates } : null,
  })),
  refresh: async () => {
    if (get().loading) return;
    set({ loading: true, error: null });
    try {
      const resp = await fetchProfile();
      const p = resp.profile;
      if (!p) {
        set({
          loading: false,
          error: resp.error || 'Profile not found on the server.',
        });
        return;
      }
      const bankParts = p.bank
        ? [p.bank.bank_name, p.bank.account_number ? `A/C ${p.bank.account_number}` : '', p.bank.ifsc_code]
            .filter(Boolean).join(' • ')
        : '';
      // Company block — mirror the Suite's CompanySettings (sourced
      // server-side from dashboard.CompanySettings.get_settings(admin_id)).
      const company = p.company
        ? {
            name:             p.company.name             || '',
            logoUrl:          p.company.logo_url         || '',
            address:          p.company.address          || '',
            phone:            p.company.contact_number   || '',
            email:            p.company.email            || '',
            gstNumber:        p.company.gst_number       || '',
            managingDirector: p.company.managing_director|| '',
          }
        : null;
      set({
        loading: false,
        error:   null,
        employee: {
          id:               p.employee_id || p.login_id,
          name:             p.name || '',
          role:             p.designation || p.job_role?.name || '',
          level:            p.level || '',
          department:       p.department || '',
          site:             p.site || '',
          location:         p.location || '',
          mobile:           p.mobile || '',
          email:            '',
          address:          '',
          emergencyContact: '',
          bankDetails:      bankParts,
          pfNumber:         p.pf?.pf_number || '',
          joiningDate:      p.joining_date || '',
          // Task 2 additions
          branch:           p.branch || '',
          baseSalary:       p.base_salary || '0',
          foodAllowance:    p.latest_salary?.food_allowance || p.fixed_allowance || '0',
          otAllowance:      p.latest_salary?.ot_allowance || '0',
          netPay:           p.latest_salary?.net_pay || '0',
          company,
        },
      });
    } catch (e: any) {
      // Network-level failure (server down, CORS preflight rejected, timeout,
      // 401, etc.). Surface the message so the screens can break out of an
      // infinite "Loading…" state and offer a retry.
      const reason = e?.message || 'Could not reach the server.';
      set({ loading: false, error: reason });
    }
  },
  clear: () => set({ employee: null, error: null }),
}));
