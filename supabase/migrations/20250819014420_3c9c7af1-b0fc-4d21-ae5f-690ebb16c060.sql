-- Create storage bucket for diagnostic question images
INSERT INTO storage.buckets (id, name, public) VALUES ('diagnostic-images', 'diagnostic-images', true);

-- Create RLS policies for diagnostic images bucket
CREATE POLICY "Public can view diagnostic images" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'diagnostic-images');

CREATE POLICY "Staff can upload diagnostic images" 
ON storage.objects 
FOR INSERT 
WITH CHECK (
  bucket_id = 'diagnostic-images' 
  AND (get_current_user_role() = ANY (ARRAY['administrador'::text, 'supervisor'::text, 'vendedor'::text]))
);

CREATE POLICY "Staff can update diagnostic images" 
ON storage.objects 
FOR UPDATE 
USING (
  bucket_id = 'diagnostic-images' 
  AND (get_current_user_role() = ANY (ARRAY['administrador'::text, 'supervisor'::text, 'vendedor'::text]))
);

CREATE POLICY "Staff can delete diagnostic images" 
ON storage.objects 
FOR DELETE 
USING (
  bucket_id = 'diagnostic-images' 
  AND (get_current_user_role() = ANY (ARRAY['administrador'::text, 'supervisor'::text, 'vendedor'::text]))
);

-- Add image_url field to diagnostic_questions table
ALTER TABLE public.diagnostic_questions 
ADD COLUMN image_url TEXT;