-- ============================================================
-- purchase_receipts table + Supabase Storage bucket
-- הרץ ב-Supabase SQL Editor
-- ============================================================

-- 1. הוסף total_amount לטבלת purchases
ALTER TABLE public.purchases
  ADD COLUMN IF NOT EXISTS total_amount NUMERIC(10,2);

-- 2. צור טבלת purchase_receipts
CREATE TABLE IF NOT EXISTS public.purchase_receipts (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_id  UUID        NOT NULL REFERENCES public.purchases(id) ON DELETE CASCADE,
  storage_path TEXT        NOT NULL,
  page_number  INT         NOT NULL DEFAULT 1,
  uploaded_by  UUID        REFERENCES auth.users(id),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_purchase_receipts_purchase_id
  ON public.purchase_receipts(purchase_id);

-- 3. RLS
ALTER TABLE public.purchase_receipts ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, DELETE ON public.purchase_receipts TO authenticated;

DROP POLICY IF EXISTS "purchase_receipts: read"   ON public.purchase_receipts;
DROP POLICY IF EXISTS "purchase_receipts: insert" ON public.purchase_receipts;
DROP POLICY IF EXISTS "purchase_receipts: delete" ON public.purchase_receipts;

CREATE POLICY "purchase_receipts: read"
  ON public.purchase_receipts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.purchases p
      WHERE p.id = purchase_id AND public.is_family_member(p.family_id)
    )
  );

CREATE POLICY "purchase_receipts: insert"
  ON public.purchase_receipts FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.purchases p
      WHERE p.id = purchase_id AND public.is_family_member(p.family_id)
    )
  );

CREATE POLICY "purchase_receipts: delete"
  ON public.purchase_receipts FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.purchases p
      WHERE p.id = purchase_id AND public.is_family_admin(p.family_id)
    )
  );

-- 4. Storage bucket (receipts — private)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'receipts',
  'receipts',
  false,
  10485760,
  ARRAY['image/jpeg','image/png','image/webp','image/heic','image/heif']
)
ON CONFLICT (id) DO NOTHING;

-- 5. Storage RLS policies
DROP POLICY IF EXISTS "receipts storage: upload" ON storage.objects;
DROP POLICY IF EXISTS "receipts storage: select" ON storage.objects;
DROP POLICY IF EXISTS "receipts storage: delete" ON storage.objects;

CREATE POLICY "receipts storage: upload"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'receipts');

CREATE POLICY "receipts storage: select"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'receipts');

CREATE POLICY "receipts storage: delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'receipts');

-- ============================================================
-- בדיקה
-- ============================================================
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('purchases', 'purchase_receipts')
ORDER BY table_name, ordinal_position;
