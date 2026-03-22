-- Persistent item category classification per family
CREATE TABLE IF NOT EXISTS public.item_categories (
  name       TEXT NOT NULL,
  category   TEXT NOT NULL,
  family_id  UUID NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  updated_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (name, family_id)
);

ALTER TABLE public.item_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "item_categories: family access"
  ON public.item_categories FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.family_id = item_categories.family_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.family_id = item_categories.family_id
    )
  );
