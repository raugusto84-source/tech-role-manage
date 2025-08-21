-- Fix foreign key constraints to allow cascade deletion where appropriate

-- 1. Allow orders to be deleted by cascading reward_transactions
ALTER TABLE public.reward_transactions 
DROP CONSTRAINT IF EXISTS reward_transactions_order_id_fkey;

ALTER TABLE public.reward_transactions
ADD CONSTRAINT reward_transactions_order_id_fkey 
FOREIGN KEY (order_id) REFERENCES public.orders(id) 
ON DELETE CASCADE;

-- 2. Allow service_types to be deleted by setting quote_items reference to NULL
ALTER TABLE public.quote_items 
DROP CONSTRAINT IF EXISTS quote_items_service_type_id_fkey;

ALTER TABLE public.quote_items
ADD CONSTRAINT quote_items_service_type_id_fkey 
FOREIGN KEY (service_type_id) REFERENCES public.service_types(id) 
ON DELETE SET NULL;

-- 3. Allow service_types to be deleted by cascading order_items
ALTER TABLE public.order_items 
DROP CONSTRAINT IF EXISTS order_items_service_type_id_fkey;

ALTER TABLE public.order_items
ADD CONSTRAINT order_items_service_type_id_fkey 
FOREIGN KEY (service_type_id) REFERENCES public.service_types(id) 
ON DELETE CASCADE;

-- 4. Allow main_service_categories to be deleted by setting problems reference to NULL
ALTER TABLE public.problems 
DROP CONSTRAINT IF EXISTS problems_category_id_fkey;

ALTER TABLE public.problems
ADD CONSTRAINT problems_category_id_fkey 
FOREIGN KEY (category_id) REFERENCES public.main_service_categories(id) 
ON DELETE SET NULL;

-- 5. Allow orders to be deleted by cascading order_items
ALTER TABLE public.order_items 
DROP CONSTRAINT IF EXISTS order_items_order_id_fkey;

ALTER TABLE public.order_items
ADD CONSTRAINT order_items_order_id_fkey 
FOREIGN KEY (order_id) REFERENCES public.orders(id) 
ON DELETE CASCADE;

-- 6. Allow orders to be deleted by cascading delivery_signatures
ALTER TABLE public.delivery_signatures 
DROP CONSTRAINT IF EXISTS delivery_signatures_order_id_fkey;

ALTER TABLE public.delivery_signatures
ADD CONSTRAINT delivery_signatures_order_id_fkey 
FOREIGN KEY (order_id) REFERENCES public.orders(id) 
ON DELETE CASCADE;

-- 7. Allow orders to be deleted by cascading order_chat_messages
ALTER TABLE public.order_chat_messages 
DROP CONSTRAINT IF EXISTS order_chat_messages_order_id_fkey;

ALTER TABLE public.order_chat_messages
ADD CONSTRAINT order_chat_messages_order_id_fkey 
FOREIGN KEY (order_id) REFERENCES public.orders(id) 
ON DELETE CASCADE;