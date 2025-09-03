-- Create chat-media storage bucket for photos and attachments
INSERT INTO storage.buckets (id, name, public) 
VALUES ('chat-media', 'chat-media', true)
ON CONFLICT (id) DO NOTHING;

-- Create RLS policies for chat media storage
CREATE POLICY "Users can upload chat media" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'chat-media' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can view chat media" ON storage.objects
FOR SELECT USING (bucket_id = 'chat-media');

CREATE POLICY "Users can update their own chat media" ON storage.objects
FOR UPDATE USING (
  bucket_id = 'chat-media' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can delete their own chat media" ON storage.objects
FOR DELETE USING (
  bucket_id = 'chat-media' AND
  (storage.foldername(name))[1] = auth.uid()::text
);