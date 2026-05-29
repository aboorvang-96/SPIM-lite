-- =============================================================================
-- SPIM Lite / SPIM Suite shared schema — review-only.
--
-- Apply this in the Supabase SQL editor AFTER reviewing every block. It is
-- idempotent (CREATE IF NOT EXISTS / CREATE OR REPLACE) so you can re-run
-- safely. RLS is enabled at the end so the anon key on the mobile app cannot
-- read other employees' rows.
--
-- Conventions:
--   - All timestamps are timestamptz, default now().
--   - Money columns are numeric(12,2) to mirror Django DecimalField.
--   - admin_id (text) is the multi-tenant scoping key, same as Django.
--   - employees.auth_user_id is the Supabase Auth uuid that the mobile app
--     logs in as. Django seeds this column when admin sets the initial
--     temporary password.
-- =============================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- 1. Helper: jwt-owned employee id ------------------------------------------
-- ---------------------------------------------------------------------------
create or replace function public.current_employee_id() returns bigint
language sql stable security definer as $$
  select id from public.employees where auth_user_id = auth.uid() limit 1;
$$;

create or replace function public.current_admin_id() returns text
language sql stable security definer as $$
  select admin_id from public.employees where auth_user_id = auth.uid() limit 1;
$$;

-- ---------------------------------------------------------------------------
-- 2. Job roles --------------------------------------------------------------
-- ---------------------------------------------------------------------------
create table if not exists public.job_roles (
  id           bigserial primary key,
  admin_id     text       not null default 'PENDING',
  name         text       not null,
  salary_type  text       not null default 'monthly' check (salary_type in ('monthly','daily')),
  base_salary  numeric(12,2) not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (admin_id, name)
);
create index if not exists job_roles_admin_idx on public.job_roles (admin_id);

-- ---------------------------------------------------------------------------
-- 3. Employees --------------------------------------------------------------
-- ---------------------------------------------------------------------------
create table if not exists public.employees (
  id                              bigserial primary key,
  auth_user_id                    uuid unique references auth.users (id) on delete set null,
  admin_id                        text not null default 'PENDING',
  name                            text not null,
  employee_id                     text not null default '',
  employee_login_id               text not null default '',
  level                           text not null default '',
  mobile                          text not null default '',
  branch                          text not null default '',
  designation                     text not null default '',
  department                      text not null default '',
  location                        text not null default '',
  site                            text not null default '',
  base_salary                     numeric(12,2) not null default 0,
  fixed_allowance                 numeric(12,2) not null default 0,
  joining_date                    date,
  status                          text not null default 'active' check (status in ('active','inactive','on_leave')),
  salary_is_custom_override       boolean not null default false,
  mobile_password_reset_required  boolean not null default false,
  mobile_account_active           boolean not null default true,
  job_role_id                     bigint references public.job_roles (id) on delete set null,
  created_at                      timestamptz not null default now(),
  updated_at                      timestamptz not null default now()
);
create index if not exists employees_admin_idx       on public.employees (admin_id);
create index if not exists employees_login_id_idx    on public.employees (employee_login_id);
create unique index if not exists employees_login_unique
  on public.employees (admin_id, lower(employee_login_id))
  where employee_login_id <> '';

-- ---------------------------------------------------------------------------
-- 4. Bank details (1:1 with employees) -------------------------------------
-- ---------------------------------------------------------------------------
create table if not exists public.bank_details (
  id              bigserial primary key,
  employee_id     bigint not null unique references public.employees (id) on delete cascade,
  bank_name       text not null default '',
  account_holder  text not null default '',
  account_number  text not null default '',
  ifsc_code       text not null default '',
  branch          text not null default '',
  status          text not null default 'pending' check (status in ('verified','pending','modified')),
  updated_at      timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 5. PF details (1:1 with employees) ---------------------------------------
-- ---------------------------------------------------------------------------
create table if not exists public.pf_details (
  id                     bigserial primary key,
  employee_id            bigint not null unique references public.employees (id) on delete cascade,
  pf_number              text not null default '',
  uan_number             text not null default '',
  esic_number            text not null default '',
  status                 text not null default 'pending' check (status in ('pending','added')),
  employee_contribution  numeric(12,2) not null default 0,
  employer_contribution  numeric(12,2) not null default 0,
  joining_date           date,
  updated_at             timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 6. Salary updates / payslips ---------------------------------------------
-- ---------------------------------------------------------------------------
create table if not exists public.salary_updates (
  id                    bigserial primary key,
  admin_id              text not null default 'PENDING',
  employee_id           bigint not null references public.employees (id) on delete cascade,
  month                 date not null,
  basic_salary          numeric(12,2) not null default 0,
  extra_allowance       numeric(12,2) not null default 0,
  ot_allowance          numeric(12,2) not null default 0,
  advance_pay           numeric(12,2) not null default 0,
  total_deduction       numeric(12,2) not null default 0,
  net_pay               numeric(12,2) not null default 0,
  pf_employer_snapshot  numeric(12,2) not null default 0,
  pf_employee_snapshot  numeric(12,2) not null default 0,
  food_allowance        numeric(12,2) not null default 0,
  food_usage            numeric(12,2) not null default 0,
  is_payslip_generated  boolean not null default false,
  payslip_generated_at  timestamptz,
  payslip_pdf_path      text,
  created_at            timestamptz not null default now(),
  unique (employee_id, month)
);
create index if not exists salary_updates_admin_idx on public.salary_updates (admin_id);

-- ---------------------------------------------------------------------------
-- 7. Attendance ------------------------------------------------------------
-- ---------------------------------------------------------------------------
create table if not exists public.attendance_records (
  id           bigserial primary key,
  admin_id     text not null default 'PENDING',
  employee_id  bigint not null references public.employees (id) on delete cascade,
  date         date not null,
  status       text not null default 'present'
               check (status in ('present','absent','half_day','leave','holiday','week_off','no_week_off')),
  source       text not null default 'employee' check (source in ('admin','employee')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (employee_id, date)
);
create index if not exists attendance_admin_idx on public.attendance_records (admin_id);
create index if not exists attendance_date_idx  on public.attendance_records (date desc);

-- ---------------------------------------------------------------------------
-- 8. Machines (projects.MachineLocation) -----------------------------------
-- ---------------------------------------------------------------------------
create table if not exists public.machine_locations (
  id         bigserial primary key,
  admin_id   text not null default 'PENDING',
  name       text not null,
  created_at timestamptz not null default now(),
  unique (admin_id, name)
);

-- ---------------------------------------------------------------------------
-- 9. Work logs (projects.WorkLog + M2M employees) --------------------------
-- ---------------------------------------------------------------------------
create table if not exists public.work_logs (
  id            bigserial primary key,
  admin_id      text not null default 'PENDING',
  date          date not null,
  location_id   bigint references public.machine_locations (id) on delete set null,
  site          text not null default '',
  work_details  text not null default '',
  tmp           integer not null default 0,
  remarks       text not null default '',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists work_logs_admin_idx on public.work_logs (admin_id);
create index if not exists work_logs_date_idx  on public.work_logs (date desc);

create table if not exists public.work_log_employees (
  work_log_id  bigint not null references public.work_logs (id) on delete cascade,
  employee_id  bigint not null references public.employees (id) on delete cascade,
  primary key (work_log_id, employee_id)
);

-- ---------------------------------------------------------------------------
-- 10. Company settings (per-tenant singleton) ------------------------------
-- ---------------------------------------------------------------------------
create table if not exists public.company_settings (
  id                bigserial primary key,
  admin_id          text not null unique default 'PENDING',
  name              text not null default '',
  logo_url          text not null default '',
  gst_number        text not null default '',
  address           text not null default '',
  contact_number    text not null default '',
  email             text not null default '',
  managing_director text not null default '',
  updated_at        timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 11. Storage bucket for payslip PDFs --------------------------------------
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
  values ('payslips', 'payslips', false)
  on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- 12. Row-Level Security ---------------------------------------------------
--     Mobile clients use the anon key. Django connects with the Postgres
--     superuser DSN and therefore bypasses RLS (so admin operations still
--     work end-to-end).
-- ---------------------------------------------------------------------------
alter table public.employees           enable row level security;
alter table public.bank_details        enable row level security;
alter table public.pf_details          enable row level security;
alter table public.salary_updates      enable row level security;
alter table public.attendance_records  enable row level security;
alter table public.work_logs           enable row level security;
alter table public.work_log_employees  enable row level security;
alter table public.machine_locations   enable row level security;
alter table public.company_settings    enable row level security;
alter table public.job_roles           enable row level security;

-- Employees: an employee can read+update their own row only.
drop policy if exists employees_self_select on public.employees;
create policy employees_self_select on public.employees
  for select to authenticated
  using (auth_user_id = auth.uid());

drop policy if exists employees_self_update on public.employees;
create policy employees_self_update on public.employees
  for update to authenticated
  using (auth_user_id = auth.uid())
  with check (auth_user_id = auth.uid());

-- Bank details: read/upsert own row.
drop policy if exists bank_self_all on public.bank_details;
create policy bank_self_all on public.bank_details
  for all to authenticated
  using (employee_id = public.current_employee_id())
  with check (employee_id = public.current_employee_id());

-- PF details: read-only for self (admin manages writes via Django).
drop policy if exists pf_self_select on public.pf_details;
create policy pf_self_select on public.pf_details
  for select to authenticated
  using (employee_id = public.current_employee_id());

-- Salary updates: read-only for self.
drop policy if exists salary_self_select on public.salary_updates;
create policy salary_self_select on public.salary_updates
  for select to authenticated
  using (employee_id = public.current_employee_id());

-- Attendance: read + upsert own rows.
drop policy if exists attendance_self_select on public.attendance_records;
create policy attendance_self_select on public.attendance_records
  for select to authenticated
  using (employee_id = public.current_employee_id());

drop policy if exists attendance_self_insert on public.attendance_records;
create policy attendance_self_insert on public.attendance_records
  for insert to authenticated
  with check (employee_id = public.current_employee_id());

drop policy if exists attendance_self_update on public.attendance_records;
create policy attendance_self_update on public.attendance_records
  for update to authenticated
  using (employee_id = public.current_employee_id())
  with check (employee_id = public.current_employee_id());

-- Machine locations: any employee in the same tenant can read.
drop policy if exists machines_tenant_select on public.machine_locations;
create policy machines_tenant_select on public.machine_locations
  for select to authenticated
  using (admin_id = public.current_admin_id());

-- Work logs: read + insert if the row belongs to this tenant. The
-- corresponding membership row in work_log_employees is what limits
-- "machines I worked on today" to this employee.
drop policy if exists worklogs_tenant_select on public.work_logs;
create policy worklogs_tenant_select on public.work_logs
  for select to authenticated
  using (admin_id = public.current_admin_id());

drop policy if exists worklogs_tenant_insert on public.work_logs;
create policy worklogs_tenant_insert on public.work_logs
  for insert to authenticated
  with check (admin_id = public.current_admin_id());

drop policy if exists worklogs_tenant_update on public.work_logs;
create policy worklogs_tenant_update on public.work_logs
  for update to authenticated
  using (admin_id = public.current_admin_id())
  with check (admin_id = public.current_admin_id());

drop policy if exists worklog_emp_self on public.work_log_employees;
create policy worklog_emp_self on public.work_log_employees
  for all to authenticated
  using (employee_id = public.current_employee_id())
  with check (employee_id = public.current_employee_id());

-- Company settings: read-only for any employee in the same tenant.
drop policy if exists company_tenant_select on public.company_settings;
create policy company_tenant_select on public.company_settings
  for select to authenticated
  using (admin_id = public.current_admin_id());

-- Job roles: read-only for tenant employees.
drop policy if exists job_roles_tenant_select on public.job_roles;
create policy job_roles_tenant_select on public.job_roles
  for select to authenticated
  using (admin_id = public.current_admin_id());

-- ---------------------------------------------------------------------------
-- 13. Storage RLS for payslips bucket --------------------------------------
--     Files are uploaded by Django at: payslips/<admin_id>/<employee_id>/<salary_update_id>.pdf
--     Each employee can only read their own folder.
-- ---------------------------------------------------------------------------
drop policy if exists payslips_self_read on storage.objects;
create policy payslips_self_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'payslips'
    and (storage.foldername(name))[2] = public.current_employee_id()::text
  );

-- =============================================================================
-- END
-- =============================================================================
