-- Add purchased_store_id and purchased_at to list_items
ALTER TABLE public.list_items
  ADD COLUMN IF NOT EXISTS purchased_store_id UUID REFERENCES stores(id),
  ADD COLUMN IF NOT EXISTS purchased_at TIMESTAMPTZ;
