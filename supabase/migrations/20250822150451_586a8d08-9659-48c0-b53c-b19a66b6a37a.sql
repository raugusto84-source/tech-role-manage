-- Ensure survey token generation works regardless of search_path
create extension if not exists pgcrypto with schema public;

create or replace function public.generate_survey_token()
returns text
language plpgsql
security definER
set search_path to 'public'
as $$
declare
  token text;
begin
  -- 16 bytes -> 32 hex chars
  token := encode(public.gen_random_bytes(16), 'hex');
  return token;
end;
$$;