-- Add family_id to stores (was global, now per-family)
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS family_id UUID REFERENCES public.families(id) ON DELETE CASCADE;

-- Set existing stores to בן עזרי family
UPDATE public.stores SET family_id = 'c56d505b-f846-4056-ba68-ec453d472fc3' WHERE family_id IS NULL;

-- Duplicate stores for לזרי family
INSERT INTO public.stores (name, family_id, is_active)
SELECT name, '85acaa1a-d45c-4f27-b5d5-943a46707059', true
FROM public.stores
WHERE family_id = 'c56d505b-f846-4056-ba68-ec453d472fc3'
ON CONFLICT DO NOTHING;

-- Drop old policies
DROP POLICY IF EXISTS "stores: כל מחובר יכול לקרוא" ON public.stores;
DROP POLICY IF EXISTS "stores: רק service_role יכול לשנות" ON public.stores;

-- New policies using family_members
CREATE POLICY "stores: family read"
  ON public.stores FOR SELECT
  USING (
    family_id IS NULL
    OR public.is_member_of(family_id)
    OR public.is_superadmin()
  );

CREATE POLICY "stores: family insert"
  ON public.stores FOR INSERT
  WITH CHECK (
    public.is_member_of(family_id)
    OR public.is_superadmin()
  );

CREATE POLICY "stores: family update"
  ON public.stores FOR UPDATE
  USING (
    public.is_admin_of(family_id)
    OR public.is_superadmin()
  );

CREATE POLICY "stores: family delete"
  ON public.stores FOR DELETE
  USING (
    public.is_admin_of(family_id)
    OR public.is_superadmin()
  );
