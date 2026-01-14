-- Crear tabla para fotos de evidencia de órdenes
CREATE TABLE public.order_evidence_photos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  photo_url TEXT NOT NULL,
  description TEXT,
  uploaded_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Índice para búsqueda rápida por orden
CREATE INDEX idx_order_evidence_photos_order_id ON public.order_evidence_photos(order_id);

-- Habilitar RLS
ALTER TABLE public.order_evidence_photos ENABLE ROW LEVEL SECURITY;

-- Política: todos pueden ver fotos
CREATE POLICY "Anyone can view evidence photos"
ON public.order_evidence_photos
FOR SELECT
USING (true);

-- Política: usuarios autenticados pueden insertar
CREATE POLICY "Authenticated users can insert photos"
ON public.order_evidence_photos
FOR INSERT
WITH CHECK (auth.uid() = uploaded_by);

-- Política: solo el que subió o admin puede eliminar
CREATE POLICY "Owner or admin can delete photos"
ON public.order_evidence_photos
FOR DELETE
USING (auth.uid() = uploaded_by);

-- Crear bucket de storage si no existe
INSERT INTO storage.buckets (id, name, public)
VALUES ('order-evidence', 'order-evidence', true)
ON CONFLICT (id) DO NOTHING;

-- Políticas de storage
CREATE POLICY "Public read access for order evidence"
ON storage.objects FOR SELECT
USING (bucket_id = 'order-evidence');

CREATE POLICY "Authenticated users can upload evidence"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'order-evidence' AND auth.role() = 'authenticated');

CREATE POLICY "Users can delete their own evidence"
ON storage.objects FOR DELETE
USING (bucket_id = 'order-evidence' AND auth.role() = 'authenticated');