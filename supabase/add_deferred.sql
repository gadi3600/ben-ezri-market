-- ============================================================
-- הוספת עמודת is_deferred לטבלת list_items
-- הרץ ב-Supabase SQL Editor
-- ============================================================

ALTER TABLE public.list_items
  ADD COLUMN IF NOT EXISTS is_deferred BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_list_items_is_deferred
  ON public.list_items(is_deferred)
  WHERE is_deferred = true;

-- ============================================================
-- בדיקה
-- ============================================================
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name   = 'list_items'
  AND column_name  = 'is_deferred';
