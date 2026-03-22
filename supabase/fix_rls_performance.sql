-- ============================================================
-- FIX RLS PERFORMANCE
-- Replace nested is_family_member()/is_family_admin() calls
-- with simple direct JOINs to auth.uid()
-- ============================================================

-- ── 1. Drop ALL existing list_items policies ─────────────────

DROP POLICY IF EXISTS "list_items: חברי משפחה יכולים לקרוא" ON public.list_items;
DROP POLICY IF EXISTS "list_items: חברי משפחה יכולים להוסיף" ON public.list_items;
DROP POLICY IF EXISTS "list_items: חברי משפחה יכולים לעדכן" ON public.list_items;
DROP POLICY IF EXISTS "list_items: חברי משפחה יכולים למחוק" ON public.list_items;

-- ── 2. New FAST list_items policies (single JOIN, no function calls) ──

CREATE POLICY "list_items: family read"
  ON public.list_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.shopping_lists sl
      JOIN public.users u ON u.family_id = sl.family_id AND u.id = auth.uid()
      WHERE sl.id = list_items.list_id
    )
  );

CREATE POLICY "list_items: family insert"
  ON public.list_items FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.shopping_lists sl
      JOIN public.users u ON u.family_id = sl.family_id AND u.id = auth.uid()
      WHERE sl.id = list_items.list_id
    )
  );

CREATE POLICY "list_items: family update"
  ON public.list_items FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.shopping_lists sl
      JOIN public.users u ON u.family_id = sl.family_id AND u.id = auth.uid()
      WHERE sl.id = list_items.list_id
    )
  );

CREATE POLICY "list_items: family delete"
  ON public.list_items FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.shopping_lists sl
      JOIN public.users u ON u.family_id = sl.family_id AND u.id = auth.uid()
      WHERE sl.id = list_items.list_id
    )
  );

-- ── 3. Drop ALL existing purchase_items policies ─────────────

DROP POLICY IF EXISTS "purchase_items: חברי משפחה יכולים לקרוא" ON public.purchase_items;
DROP POLICY IF EXISTS "purchase_items: חברי משפחה יכולים להוסיף" ON public.purchase_items;
DROP POLICY IF EXISTS "purchase_items: חברי משפחה יכולים לעדכן" ON public.purchase_items;
DROP POLICY IF EXISTS "purchase_items: admin יכול למחוק" ON public.purchase_items;

-- ── 4. New FAST purchase_items policies ──

CREATE POLICY "purchase_items: family read"
  ON public.purchase_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.purchases p
      JOIN public.users u ON u.family_id = p.family_id AND u.id = auth.uid()
      WHERE p.id = purchase_items.purchase_id
    )
  );

CREATE POLICY "purchase_items: family insert"
  ON public.purchase_items FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.purchases p
      JOIN public.users u ON u.family_id = p.family_id AND u.id = auth.uid()
      WHERE p.id = purchase_items.purchase_id
    )
  );

CREATE POLICY "purchase_items: family update"
  ON public.purchase_items FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.purchases p
      JOIN public.users u ON u.family_id = p.family_id AND u.id = auth.uid()
      WHERE p.id = purchase_items.purchase_id
    )
  );

CREATE POLICY "purchase_items: family delete"
  ON public.purchase_items FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.purchases p
      JOIN public.users u ON u.family_id = p.family_id AND u.id = auth.uid()
      WHERE p.id = purchase_items.purchase_id
    )
  );

-- ── 5. Drop and replace purchases policies ───────────────────

DROP POLICY IF EXISTS "purchases: חברי משפחה יכולים לקרוא" ON public.purchases;
DROP POLICY IF EXISTS "purchases: חברי משפחה יכולים ליצור" ON public.purchases;
DROP POLICY IF EXISTS "purchases: המבצע יכול לעדכן" ON public.purchases;
DROP POLICY IF EXISTS "purchases: admin יכול למחוק" ON public.purchases;

CREATE POLICY "purchases: family read"
  ON public.purchases FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.family_id = purchases.family_id
    )
  );

CREATE POLICY "purchases: family insert"
  ON public.purchases FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.family_id = purchases.family_id
    )
  );

CREATE POLICY "purchases: family update"
  ON public.purchases FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.family_id = purchases.family_id
    )
  );

CREATE POLICY "purchases: family delete"
  ON public.purchases FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.family_id = purchases.family_id
      AND u.role = 'admin'
    )
  );

-- ── 6. Drop and replace shopping_lists policies ──────────────

DROP POLICY IF EXISTS "shopping_lists: חברי משפחה יכולים לקרוא" ON public.shopping_lists;
DROP POLICY IF EXISTS "shopping_lists: חברי משפחה יכולים ליצור" ON public.shopping_lists;
DROP POLICY IF EXISTS "shopping_lists: חברי משפחה יכולים לעדכן" ON public.shopping_lists;
DROP POLICY IF EXISTS "shopping_lists: admin יכול למחוק" ON public.shopping_lists;

CREATE POLICY "shopping_lists: family read"
  ON public.shopping_lists FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.family_id = shopping_lists.family_id
    )
  );

CREATE POLICY "shopping_lists: family insert"
  ON public.shopping_lists FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.family_id = shopping_lists.family_id
    )
  );

CREATE POLICY "shopping_lists: family update"
  ON public.shopping_lists FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.family_id = shopping_lists.family_id
    )
  );

CREATE POLICY "shopping_lists: admin delete"
  ON public.shopping_lists FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.family_id = shopping_lists.family_id
      AND u.role = 'admin'
    )
  );

-- ── 7. Ensure indexes exist for the JOINs ───────────────────

CREATE INDEX IF NOT EXISTS idx_users_id_family ON public.users(id, family_id);
CREATE INDEX IF NOT EXISTS idx_users_id_family_role ON public.users(id, family_id, role);
CREATE INDEX IF NOT EXISTS idx_shopping_lists_id_family ON public.shopping_lists(id, family_id);
CREATE INDEX IF NOT EXISTS idx_purchases_id_family ON public.purchases(id, family_id);
