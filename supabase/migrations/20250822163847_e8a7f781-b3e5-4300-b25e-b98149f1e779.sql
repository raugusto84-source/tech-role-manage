-- Add UPDATE trigger to create initial policy payment when reactivating assignment
DROP TRIGGER IF EXISTS trg_create_initial_policy_payment_update ON public.policy_clients;

CREATE TRIGGER trg_create_initial_policy_payment_update
AFTER UPDATE OF is_active ON public.policy_clients
FOR EACH ROW
WHEN (NEW.is_active = true AND (OLD.is_active IS DISTINCT FROM NEW.is_active))
EXECUTE FUNCTION public.create_initial_policy_payment();