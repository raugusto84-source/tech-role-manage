-- Allow deleting policies without breaking existing orders by nullifying the reference
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_policy_id_fkey;
ALTER TABLE public.orders
ADD CONSTRAINT orders_policy_id_fkey
FOREIGN KEY (policy_id)
REFERENCES public.insurance_policies(id)
ON DELETE SET NULL;