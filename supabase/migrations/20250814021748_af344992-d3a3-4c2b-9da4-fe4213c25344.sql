-- Crear bucket para fotos de control de tiempo
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'time-tracking-photos', 
  'time-tracking-photos', 
  true,
  5242880, -- 5MB
  '{"image/jpeg", "image/png", "image/webp"}'
);

-- Crear políticas de seguridad para el bucket
CREATE POLICY "Users can upload their own time tracking photos"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'time-tracking-photos' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can view their own time tracking photos"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'time-tracking-photos' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Admins can view all time tracking photos"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'time-tracking-photos' 
  AND EXISTS (
    SELECT 1 FROM profiles 
    WHERE user_id = auth.uid() 
    AND role = 'administrador'
  )
);

CREATE POLICY "Users can update their own time tracking photos"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'time-tracking-photos' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete their own time tracking photos"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'time-tracking-photos' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);