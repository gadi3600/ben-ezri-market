-- ============================================================
-- Fix RLS: use family_members instead of users.family_id
-- This supports users belonging to multiple families
-- ============================================================

-- Helper: check if current user is a member of a given family
CREATE OR REPLACE FUNCTION public.is_member_of(fam_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.family_members
    WHERE user_id = auth.uid() AND family_id = fam_id
  );
$$;

-- Helper: check if current user is admin of a given family
CREATE OR REPLACE FUNCTION public.is_admin_of(fam_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.family_members
    WHERE user_id = auth.uid() AND family_id = fam_id AND role = 'admin'
  );
$$;

-- Helper: check if superadmin
CREATE OR REPLACE FUNCTION public.is_superadmin()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND is_superadmin = true
  );
$$;

-- ── shopping_lists ──────────────────────────────────────────
DROP POLICY IF EXISTS "shopping_lists: family read" ON public.shopping_lists;
DROP POLICY IF EXISTS "shopping_lists: family insert" ON public.shopping_lists;
DROP POLICY IF EXISTS "shopping_lists: family update" ON public.shopping_lists;
DROP POLICY IF EXISTS "shopping_lists: admin delete" ON public.shopping_lists;
DROP POLICY IF EXISTS "shopping_lists: superadmin read" ON public.shopping_lists;

CREATE POLICY "shopping_lists: read"
  ON public.shopping_lists FOR SELECT
  USING (public.is_member_of(family_id) OR public.is_superadmin());

CREATE POLICY "shopping_lists: insert"
  ON public.shopping_lists FOR INSERT
  WITH CHECK (public.is_member_of(family_id) OR public.is_superadmin());

CREATE POLICY "shopping_lists: update"
  ON public.shopping_lists FOR UPDATE
  USING (public.is_member_of(family_id) OR public.is_superadmin());

CREATE POLICY "shopping_lists: delete"
  ON public.shopping_lists FOR DELETE
  USING (public.is_admin_of(family_id) OR public.is_superadmin());

-- ── list_items ──────────────────────────────────────────────
DROP POLICY IF EXISTS "list_items: family read" ON public.list_items;
DROP POLICY IF EXISTS "list_items: family insert" ON public.list_items;
DROP POLICY IF EXISTS "list_items: family update" ON public.list_items;
DROP POLICY IF EXISTS "list_items: family delete" ON public.list_items;
DROP POLICY IF EXISTS "list_items: superadmin read" ON public.list_items;

CREATE POLICY "list_items: read"
  ON public.list_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.shopping_lists sl
      WHERE sl.id = list_items.list_id
      AND (public.is_member_of(sl.family_id) OR public.is_superadmin())
    )
  );

CREATE POLICY "list_items: insert"
  ON public.list_items FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.shopping_lists sl
      WHERE sl.id = list_items.list_id
      AND (public.is_member_of(sl.family_id) OR public.is_superadmin())
    )
  );

CREATE POLICY "list_items: update"
  ON public.list_items FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.shopping_lists sl
      WHERE sl.id = list_items.list_id
      AND (public.is_member_of(sl.family_id) OR public.is_superadmin())
    )
  );

CREATE POLICY "list_items: delete"
  ON public.list_items FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.shopping_lists sl
      WHERE sl.id = list_items.list_id
      AND (public.is_admin_of(sl.family_id) OR public.is_superadmin())
    )
  );

-- ── purchases ───────────────────────────────────────────────
DROP POLICY IF EXISTS "purchases: family read" ON public.purchases;
DROP POLICY IF EXISTS "purchases: family insert" ON public.purchases;
DROP POLICY IF EXISTS "purchases: family update" ON public.purchases;
DROP POLICY IF EXISTS "purchases: family delete" ON public.purchases;

CREATE POLICY "purchases: read"
  ON public.purchases FOR SELECT
  USING (public.is_member_of(family_id) OR public.is_superadmin());

CREATE POLICY "purchases: insert"
  ON public.purchases FOR INSERT
  WITH CHECK (public.is_member_of(family_id) OR public.is_superadmin());

CREATE POLICY "purchases: update"
  ON public.purchases FOR UPDATE
  USING (public.is_member_of(family_id) OR public.is_superadmin());

CREATE POLICY "purchases: delete"
  ON public.purchases FOR DELETE
  USING (public.is_admin_of(family_id) OR public.is_superadmin());

-- ── purchase_items ──────────────────────────────────────────
DROP POLICY IF EXISTS "purchase_items: family read" ON public.purchase_items;
DROP POLICY IF EXISTS "purchase_items: family insert" ON public.purchase_items;
DROP POLICY IF EXISTS "purchase_items: family update" ON public.purchase_items;
DROP POLICY IF EXISTS "purchase_items: family delete" ON public.purchase_items;

CREATE POLICY "purchase_items: read"
  ON public.purchase_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.purchases p
      WHERE p.id = purchase_items.purchase_id
      AND (public.is_member_of(p.family_id) OR public.is_superadmin())
    )
  );

CREATE POLICY "purchase_items: insert"
  ON public.purchase_items FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.purchases p
      WHERE p.id = purchase_items.purchase_id
      AND (public.is_member_of(p.family_id) OR public.is_superadmin())
    )
  );

CREATE POLICY "purchase_items: update"
  ON public.purchase_items FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.purchases p
      WHERE p.id = purchase_items.purchase_id
      AND (public.is_member_of(p.family_id) OR public.is_superadmin())
    )
  );

CREATE POLICY "purchase_items: delete"
  ON public.purchase_items FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.purchases p
      WHERE p.id = purchase_items.purchase_id
      AND (public.is_admin_of(p.family_id) OR public.is_superadmin())
    )
  );
