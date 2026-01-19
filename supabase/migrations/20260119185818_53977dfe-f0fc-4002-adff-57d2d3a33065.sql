-- Backfill missing user_roles rows for existing staff users (fixes has_role() checks for JCF, etc.)

INSERT INTO public.user_roles (user_id, role)
SELECT p.user_id, p.role
FROM public.profiles p
WHERE p.role IS NOT NULL
  AND p.role <> 'cliente'::user_role
  AND NOT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = p.user_id
      AND ur.role = p.role
  )
ON CONFLICT DO NOTHING;