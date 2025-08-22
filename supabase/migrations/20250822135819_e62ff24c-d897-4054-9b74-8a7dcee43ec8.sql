-- Create storage bucket for order evidence photos
INSERT INTO storage.buckets (id, name, public) VALUES ('order-evidence', 'order-evidence', true);

-- Create storage policies for order evidence photos
CREATE POLICY "Anyone can view order evidence photos" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'order-evidence');

CREATE POLICY "Authenticated users can upload order evidence photos" 
ON storage.objects FOR INSERT 
WITH CHECK (bucket_id = 'order-evidence' AND auth.role() = 'authenticated');

CREATE POLICY "Users can update their own order evidence photos" 
ON storage.objects FOR UPDATE 
USING (bucket_id = 'order-evidence' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own order evidence photos" 
ON storage.objects FOR DELETE 
USING (bucket_id = 'order-evidence' AND auth.uid()::text = (storage.foldername(name))[1]);