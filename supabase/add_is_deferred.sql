-- Add is_deferred column to list_items (was missing from schema)
ALTER TABLE public.list_items
  ADD COLUMN IF NOT EXISTS is_deferred BOOLEAN NOT NULL DEFAULT false;
