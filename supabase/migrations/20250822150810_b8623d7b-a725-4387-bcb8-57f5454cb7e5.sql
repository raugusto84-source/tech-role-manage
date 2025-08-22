-- Install pgcrypto in the standard Supabase schema for extensions
create extension if not exists pgcrypto with schema extensions;

-- Generate survey token using the extensions schema explicitly
create or replace function public.generate_survey_token()
returns text
language sql
stable
set search_path to 'public','extensions'
as $$
  select encode(extensions.gen_random_bytes(16), 'hex');
$$;