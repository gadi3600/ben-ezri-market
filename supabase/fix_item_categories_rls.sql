-- Fix item_categories RLS: use family_members instead of users.family_id
DROP POLICY IF EXISTS "item_categories: family access" ON public.item_categories;

CREATE POLICY "item_categories: family access"
  ON public.item_categories FOR ALL
  USING (public.is_member_of(family_id) OR public.is_superadmin())
  WITH CHECK (public.is_member_of(family_id) OR public.is_superadmin());

-- Also fix shopping_order RLS (same issue)
DROP POLICY IF EXISTS "shopping_order: family access" ON public.shopping_order;

CREATE POLICY "shopping_order: family access"
  ON public.shopping_order FOR ALL
  USING (public.is_member_of(family_id) OR public.is_superadmin())
  WITH CHECK (public.is_member_of(family_id) OR public.is_superadmin());
