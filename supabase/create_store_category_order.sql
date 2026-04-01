-- Store-specific category ordering
CREATE TABLE IF NOT EXISTS public.store_category_order (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id    UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  family_id   UUID NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  category_order JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (store_id, family_id)
);

ALTER TABLE public.store_category_order ENABLE ROW LEVEL SECURITY;

CREATE POLICY "store_category_order: family read"
  ON public.store_category_order FOR SELECT
  USING (public.is_member_of(family_id) OR public.is_superadmin());

CREATE POLICY "store_category_order: admin write"
  ON public.store_category_order FOR INSERT
  WITH CHECK (public.is_member_of(family_id) OR public.is_superadmin());

CREATE POLICY "store_category_order: admin update"
  ON public.store_category_order FOR UPDATE
  USING (public.is_member_of(family_id) OR public.is_superadmin())
  WITH CHECK (public.is_member_of(family_id) OR public.is_superadmin());

CREATE POLICY "store_category_order: admin delete"
  ON public.store_category_order FOR DELETE
  USING (public.is_member_of(family_id) OR public.is_superadmin());
