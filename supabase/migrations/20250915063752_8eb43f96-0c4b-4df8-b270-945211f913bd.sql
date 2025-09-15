-- Ensure only one pending collection per order and trigger only on authorization

-- 1) Clean possible duplicates again (keep latest per order)
WITH ranked AS (
  SELECT id, order_id, created_at,
         ROW_NUMBER() OVER (PARTITION BY order_id ORDER BY created_at DESC) AS rn
  FROM public.pending_collections
)
DELETE FROM public.pending_collections pc
USING ranked r
WHERE pc.id = r.id AND r.rn > 1;

-- 2) Add unique constraint to enforce single record per order
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'pending_collections_order_id_key'
  ) THEN
    ALTER TABLE public.pending_collections
    ADD CONSTRAINT pending_collections_order_id_key UNIQUE (order_id);
  END IF;
END $$;

-- 3) Recreate trigger on orders to run only AFTER UPDATE (authorization)
DROP TRIGGER IF EXISTS trg_manage_pending_collections ON public.orders;
CREATE TRIGGER trg_manage_pending_collections
AFTER UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.manage_pending_collections();

-- 4) Ensure items trigger exists to keep totals in sync after approval
DROP TRIGGER IF EXISTS trg_update_pending_on_items ON public.order_items;
CREATE TRIGGER trg_update_pending_on_items
AFTER INSERT OR UPDATE OR DELETE ON public.order_items
FOR EACH ROW
EXECUTE FUNCTION public.update_pending_collections_on_items();