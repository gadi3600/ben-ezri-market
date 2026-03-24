-- Fix: users SELECT policy — use family_members instead of users.family_id
-- Old policy used is_family_member() which only checks users.family_id (single family)

DROP POLICY IF EXISTS "users: חברי משפחה יכולים לראות אחד את" ON public.users;

-- New: you can read yourself + any user who shares a family with you via family_members
CREATE POLICY "users: read self and family peers"
  ON public.users FOR SELECT
  USING (
    id = auth.uid()
    OR id IN (
      SELECT fm.user_id FROM public.family_members fm
      WHERE fm.family_id IN (SELECT public.get_my_family_ids())
    )
  );
