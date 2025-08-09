-- Add foreign key relationship between order_notes and profiles
ALTER TABLE public.order_notes 
ADD CONSTRAINT fk_order_notes_user_id 
FOREIGN KEY (user_id) REFERENCES public.profiles(user_id) 
ON DELETE CASCADE;