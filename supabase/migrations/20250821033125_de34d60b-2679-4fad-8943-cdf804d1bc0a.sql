-- Agregar columnas de imagen y stock a service_types
ALTER TABLE service_types 
ADD COLUMN IF NOT EXISTS image_url TEXT,
ADD COLUMN IF NOT EXISTS stock_quantity INTEGER DEFAULT 0;

-- Crear bucket para imágenes de servicios
INSERT INTO storage.buckets (id, name, public) 
VALUES ('service-images', 'service-images', true)
ON CONFLICT (id) DO NOTHING;

-- Crear políticas de storage para service-images
CREATE POLICY "Anyone can view service images" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'service-images');

CREATE POLICY "Authenticated users can upload service images" 
ON storage.objects FOR INSERT 
WITH CHECK (
  bucket_id = 'service-images' 
  AND auth.role() = 'authenticated'
);

CREATE POLICY "Authenticated users can update service images" 
ON storage.objects FOR UPDATE 
USING (
  bucket_id = 'service-images' 
  AND auth.role() = 'authenticated'
);

CREATE POLICY "Authenticated users can delete service images" 
ON storage.objects FOR DELETE 
USING (
  bucket_id = 'service-images' 
  AND auth.role() = 'authenticated'
);