-- ============================================================
-- CLEANUP: Remove old slow policies (Hebrew names with is_family_member)
-- Keep only the new fast policies (English names with direct JOINs)
-- ============================================================

-- list_items (4 old policies)
DROP POLICY IF EXISTS "list_items: חברי משפחה יכולים לקרוא" ON public.list_items;
DROP POLICY IF EXISTS "list_items: חברי משפחה יכולים להוסיף" ON public.list_items;
DROP POLICY IF EXISTS "list_items: חברי משפחה יכולים לעדכן" ON public.list_items;
DROP POLICY IF EXISTS "list_items: חברי משפחה יכולים למחוק" ON public.list_items;

-- purchase_items (4 old policies)
DROP POLICY IF EXISTS "purchase_items: חברי משפחה יכולים לקרוא" ON public.purchase_items;
DROP POLICY IF EXISTS "purchase_items: חברי משפחה יכולים להוסיף" ON public.purchase_items;
DROP POLICY IF EXISTS "purchase_items: חברי משפחה יכולים לעדכן" ON public.purchase_items;
DROP POLICY IF EXISTS "purchase_items: admin יכול למחוק" ON public.purchase_items;

-- purchases (4 old policies)
DROP POLICY IF EXISTS "purchases: חברי משפחה יכולים לקרוא" ON public.purchases;
DROP POLICY IF EXISTS "purchases: חברי משפחה יכולים ליצור" ON public.purchases;
DROP POLICY IF EXISTS "purchases: המבצע יכול לעדכן" ON public.purchases;
DROP POLICY IF EXISTS "purchases: admin יכול למחוק" ON public.purchases;

-- shopping_lists (4 old policies)
DROP POLICY IF EXISTS "shopping_lists: חברי משפחה יכולים לקרוא" ON public.shopping_lists;
DROP POLICY IF EXISTS "shopping_lists: חברי משפחה יכולים ליצור" ON public.shopping_lists;
DROP POLICY IF EXISTS "shopping_lists: חברי משפחה יכולים לעדכן" ON public.shopping_lists;
DROP POLICY IF EXISTS "shopping_lists: admin יכול למחוק" ON public.shopping_lists;
