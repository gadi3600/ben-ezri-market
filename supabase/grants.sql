-- ============================================================
-- בן עזרי מרקט — Table & Function Grants
-- ============================================================
-- הרץ קובץ זה ב-Supabase SQL Editor
--
-- ההבדל:
--   GRANT  = מי בכלל מורשה לגשת לטבלה (ברמת PostgreSQL role)
--   RLS    = אילו שורות ספציפיות מוצגות (ברמת פוליסה)
-- ב-Supabase צריך את שניהם — RLS לבד לא מספיק!
-- ============================================================


-- ============================================================
-- 1. הרשאות טבלאות — authenticated (משתמש מחובר)
-- ============================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON public.families       TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.users          TO authenticated;
GRANT SELECT                         ON public.stores         TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.products       TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shopping_lists TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.list_items     TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.purchases      TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.purchase_items TO authenticated;


-- ============================================================
-- 2. הרשאות טבלאות — anon (משתמש לא מחובר)
--    מינימום — רק מה שצריך לפני login
-- ============================================================

-- anon לא צריך גישה לטבלאות (auth מטופל דרך supabase.auth)
-- אבל PostgREST דורש לפחות USAGE על ה-schema
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;


-- ============================================================
-- 3. הרשאות Views
-- ============================================================

GRANT SELECT ON public.v_active_lists      TO authenticated;
GRANT SELECT ON public.v_purchase_history  TO authenticated;


-- ============================================================
-- 4. הרשאות פונקציות — authenticated
-- ============================================================

GRANT EXECUTE ON FUNCTION public.create_family(TEXT)     TO authenticated;
GRANT EXECUTE ON FUNCTION public.join_family(TEXT)       TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_family_id()      TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_family_member(UUID)  TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_family_admin(UUID)   TO authenticated;


-- ============================================================
-- 5. וידוא policies קיימות (DROP IF EXISTS + CREATE)
--    מריץ מחדש בטוח — לא יכשל אם כבר קיים
-- ============================================================

-- ── families ─────────────────────────────────────────────────
DROP POLICY IF EXISTS "families: חברי המשפחה יכולים לקרוא"    ON public.families;
DROP POLICY IF EXISTS "families: כל משתמש מחובר יכול ליצור משפחה" ON public.families;
DROP POLICY IF EXISTS "families: רק admin יכול לעדכן"          ON public.families;
DROP POLICY IF EXISTS "families: רק admin יכול למחוק"          ON public.families;

CREATE POLICY "families: חברי המשפחה יכולים לקרוא"
  ON public.families FOR SELECT
  USING (public.is_family_member(id));

-- INSERT מטופל על-ידי create_family() RPC — לא ישירות מהלקוח
-- אבל נשאיר פוליסה למקרה
CREATE POLICY "families: כל משתמש מחובר יכול ליצור משפחה"
  ON public.families FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "families: רק admin יכול לעדכן"
  ON public.families FOR UPDATE
  USING (public.is_family_admin(id));

CREATE POLICY "families: רק admin יכול למחוק"
  ON public.families FOR DELETE
  USING (public.is_family_admin(id));

-- ── users ────────────────────────────────────────────────────
DROP POLICY IF EXISTS "users: חברי משפחה יכולים לראות אחד את השני" ON public.users;
DROP POLICY IF EXISTS "users: המשתמש יכול לעדכן את עצמו"           ON public.users;
DROP POLICY IF EXISTS "users: insert דרך trigger בלבד"              ON public.users;

CREATE POLICY "users: חברי משפחה יכולים לראות אחד את השני"
  ON public.users FOR SELECT
  USING (
    id = auth.uid()
    OR (family_id IS NOT NULL AND public.is_family_member(family_id))
  );

CREATE POLICY "users: המשתמש יכול לעדכן את עצמו"
  ON public.users FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

CREATE POLICY "users: insert דרך trigger בלבד"
  ON public.users FOR INSERT
  WITH CHECK (id = auth.uid());

-- ── stores ────────────────────────────────────────────────────
DROP POLICY IF EXISTS "stores: כל מחובר יכול לקרוא"    ON public.stores;
DROP POLICY IF EXISTS "stores: רק service_role יכול לשנות" ON public.stores;

CREATE POLICY "stores: כל מחובר יכול לקרוא"
  ON public.stores FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- ── shopping_lists ────────────────────────────────────────────
DROP POLICY IF EXISTS "shopping_lists: חברי משפחה יכולים לקרוא"   ON public.shopping_lists;
DROP POLICY IF EXISTS "shopping_lists: חברי משפחה יכולים ליצור"   ON public.shopping_lists;
DROP POLICY IF EXISTS "shopping_lists: חברי משפחה יכולים לעדכן"   ON public.shopping_lists;
DROP POLICY IF EXISTS "shopping_lists: admin יכול למחוק"           ON public.shopping_lists;

CREATE POLICY "shopping_lists: חברי משפחה יכולים לקרוא"
  ON public.shopping_lists FOR SELECT
  USING (public.is_family_member(family_id));

CREATE POLICY "shopping_lists: חברי משפחה יכולים ליצור"
  ON public.shopping_lists FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND family_id = public.get_my_family_id()
  );

CREATE POLICY "shopping_lists: חברי משפחה יכולים לעדכן"
  ON public.shopping_lists FOR UPDATE
  USING (public.is_family_member(family_id));

CREATE POLICY "shopping_lists: admin יכול למחוק"
  ON public.shopping_lists FOR DELETE
  USING (public.is_family_admin(family_id));

-- ── list_items ────────────────────────────────────────────────
DROP POLICY IF EXISTS "list_items: חברי משפחה יכולים לקרוא"   ON public.list_items;
DROP POLICY IF EXISTS "list_items: חברי משפחה יכולים להוסיף"  ON public.list_items;
DROP POLICY IF EXISTS "list_items: חברי משפחה יכולים לעדכן"   ON public.list_items;
DROP POLICY IF EXISTS "list_items: חברי משפחה יכולים למחוק"   ON public.list_items;

CREATE POLICY "list_items: חברי משפחה יכולים לקרוא"
  ON public.list_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.shopping_lists sl
      WHERE sl.id = list_id AND public.is_family_member(sl.family_id)
    )
  );

CREATE POLICY "list_items: חברי משפחה יכולים להוסיף"
  ON public.list_items FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.shopping_lists sl
      WHERE sl.id = list_id AND public.is_family_member(sl.family_id)
    )
  );

CREATE POLICY "list_items: חברי משפחה יכולים לעדכן"
  ON public.list_items FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.shopping_lists sl
      WHERE sl.id = list_id AND public.is_family_member(sl.family_id)
    )
  );

CREATE POLICY "list_items: חברי משפחה יכולים למחוק"
  ON public.list_items FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.shopping_lists sl
      WHERE sl.id = list_id AND public.is_family_member(sl.family_id)
    )
  );

-- ── purchases ─────────────────────────────────────────────────
DROP POLICY IF EXISTS "purchases: חברי משפחה יכולים לקרוא"  ON public.purchases;
DROP POLICY IF EXISTS "purchases: חברי משפחה יכולים ליצור"  ON public.purchases;
DROP POLICY IF EXISTS "purchases: המבצע יכול לעדכן"         ON public.purchases;
DROP POLICY IF EXISTS "purchases: admin יכול למחוק"         ON public.purchases;

CREATE POLICY "purchases: חברי משפחה יכולים לקרוא"
  ON public.purchases FOR SELECT
  USING (public.is_family_member(family_id));

CREATE POLICY "purchases: חברי משפחה יכולים ליצור"
  ON public.purchases FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND family_id = public.get_my_family_id()
  );

CREATE POLICY "purchases: המבצע יכול לעדכן"
  ON public.purchases FOR UPDATE
  USING (
    purchased_by = auth.uid()
    OR public.is_family_admin(family_id)
  );

CREATE POLICY "purchases: admin יכול למחוק"
  ON public.purchases FOR DELETE
  USING (public.is_family_admin(family_id));

-- ── purchase_items ────────────────────────────────────────────
DROP POLICY IF EXISTS "purchase_items: חברי משפחה יכולים לקרוא"   ON public.purchase_items;
DROP POLICY IF EXISTS "purchase_items: חברי משפחה יכולים להוסיף"  ON public.purchase_items;
DROP POLICY IF EXISTS "purchase_items: חברי משפחה יכולים לעדכן"   ON public.purchase_items;
DROP POLICY IF EXISTS "purchase_items: admin יכול למחוק"           ON public.purchase_items;

CREATE POLICY "purchase_items: חברי משפחה יכולים לקרוא"
  ON public.purchase_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.purchases p
      WHERE p.id = purchase_id AND public.is_family_member(p.family_id)
    )
  );

CREATE POLICY "purchase_items: חברי משפחה יכולים להוסיף"
  ON public.purchase_items FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.purchases p
      WHERE p.id = purchase_id AND public.is_family_member(p.family_id)
    )
  );

CREATE POLICY "purchase_items: חברי משפחה יכולים לעדכן"
  ON public.purchase_items FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.purchases p
      WHERE p.id = purchase_id AND public.is_family_member(p.family_id)
    )
  );

CREATE POLICY "purchase_items: admin יכול למחוק"
  ON public.purchase_items FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.purchases p
      WHERE p.id = purchase_id AND public.is_family_admin(p.family_id)
    )
  );


-- ============================================================
-- 6. בדיקה — הרץ אחרי הכל
-- ============================================================

-- אמור להחזיר את כל הטבלאות עם has_privs=true
SELECT
  table_name,
  has_table_privilege('authenticated', 'public.' || table_name, 'SELECT') AS can_select,
  has_table_privilege('authenticated', 'public.' || table_name, 'INSERT') AS can_insert
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE'
ORDER BY table_name;
