-- Custom categories per family
CREATE TABLE IF NOT EXISTS public.custom_categories (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id  UUID NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  emoji      TEXT NOT NULL DEFAULT '📁',
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (family_id, name)
);

ALTER TABLE public.custom_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "custom_categories: family access"
  ON public.custom_categories FOR ALL
  USING (public.is_member_of(family_id) OR public.is_superadmin())
  WITH CHECK (public.is_member_of(family_id) OR public.is_superadmin());
