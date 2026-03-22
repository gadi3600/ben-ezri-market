-- Shared shopping order data (synced between family members)
CREATE TABLE IF NOT EXISTS public.shopping_order (
  family_id  UUID NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  type       TEXT NOT NULL,
  order_data JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (family_id, type)
);

ALTER TABLE public.shopping_order ENABLE ROW LEVEL SECURITY;

CREATE POLICY "shopping_order: family access"
  ON public.shopping_order FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.family_id = shopping_order.family_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.family_id = shopping_order.family_id
    )
  );

-- Enable realtime for this table
ALTER PUBLICATION supabase_realtime ADD TABLE public.shopping_order;
