-- Recreate fixed_expenses with policies and trigger atomically
begin;

-- Table
create table if not exists public.fixed_expenses (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  description text not null,
  amount numeric not null,
  account_type public.account_type not null default 'no_fiscal',
  payment_method text,
  frequency text not null default 'monthly',
  next_run_date date not null default current_date,
  last_run_date date,
  active boolean not null default true,
  created_by uuid
);

-- RLS
alter table public.fixed_expenses enable row level security;

-- Policies
drop policy if exists "Admins can manage fixed expenses" on public.fixed_expenses;
drop policy if exists "Staff can view fixed expenses" on public.fixed_expenses;

create policy "Admins can manage fixed expenses"
  on public.fixed_expenses
  for all
  using (get_current_user_role() = 'administrador')
  with check (get_current_user_role() = 'administrador');

create policy "Staff can view fixed expenses"
  on public.fixed_expenses
  for select
  using (get_current_user_role() = any (array['administrador','tecnico','vendedor']));

-- Trigger
drop trigger if exists fixed_expenses_set_updated_at on public.fixed_expenses;
create trigger fixed_expenses_set_updated_at
before update on public.fixed_expenses
for each row execute function public.update_updated_at_column();

-- Indexes
create index if not exists idx_fixed_expenses_next_run on public.fixed_expenses (active, next_run_date);

commit;