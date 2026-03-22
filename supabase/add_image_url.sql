-- Add image_url column to list_items
ALTER TABLE public.list_items
  ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Create storage bucket for list item images (public read)
INSERT INTO storage.buckets (id, name, public)
VALUES ('list-item-images', 'list-item-images', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload to list-item-images
CREATE POLICY "list-item-images: authenticated upload"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'list-item-images'
    AND auth.uid() IS NOT NULL
  );

-- Allow public read for list-item-images
CREATE POLICY "list-item-images: public read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'list-item-images');

-- Allow authenticated users to delete their uploads
CREATE POLICY "list-item-images: authenticated delete"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'list-item-images'
    AND auth.uid() IS NOT NULL
  );
