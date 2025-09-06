-- Fix security warning: change security_invoker to security_definer for views
ALTER VIEW public.pending_collections SET (security_invoker = off);