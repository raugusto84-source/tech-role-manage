-- Fix trigger creation (idempotent)
drop trigger if exists fixed_expenses_set_updated_at on public.fixed_expenses;
create trigger fixed_expenses_set_updated_at
before update on public.fixed_expenses
for each row execute function public.update_updated_at_column();