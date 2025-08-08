-- Create table for recurring payrolls (idempotent)
create table if not exists public.recurring_payrolls (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  employee_name text not null,
  base_salary numeric not null,
  net_salary numeric not null,
  account_type public.account_type not null default 'no_fiscal',
  payment_method text,
  frequency text not null default 'monthly',
  next_run_date date not null default current_date,
  last_run_date date,
  active boolean not null default true,
  created_by uuid
);

alter table public.recurring_payrolls enable row level security;

drop policy if exists "Admins can manage recurring payrolls" on public.recurring_payrolls;
drop policy if exists "Staff can view recurring payrolls" on public.recurring_payrolls;

create policy "Admins can manage recurring payrolls"
  on public.recurring_payrolls
  for all
  using (get_current_user_role() = 'administrador')
  with check (get_current_user_role() = 'administrador');

create policy "Staff can view recurring payrolls"
  on public.recurring_payrolls
  for select
  using (get_current_user_role() = any (array['administrador','tecnico','vendedor']));

-- Trigger and index
drop trigger if exists recurring_payrolls_set_updated_at on public.recurring_payrolls;
create trigger recurring_payrolls_set_updated_at
before update on public.recurring_payrolls
for each row execute function public.update_updated_at_column();

create index if not exists idx_recurring_payrolls_next_run on public.recurring_payrolls (active, next_run_date);
