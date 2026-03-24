-- Fix: allow users to see other members of their families
-- Current: only "read own" (user_id = auth.uid()) exists

-- Step 1: Create helper function (SECURITY DEFINER bypasses RLS)
CREATE OR REPLACE FUNCTION public.get_my_family_ids()
RETURNS SETOF UUID
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT family_id FROM public.family_members WHERE user_id = auth.uid();
$$;

-- Step 2: Drop old restrictive policy
DROP POLICY IF EXISTS "family_members: read own" ON public.family_members;
DROP POLICY IF EXISTS "family_members: read own and peers" ON public.family_members;
DROP POLICY IF EXISTS "family_members: read own families" ON public.family_members;
DROP POLICY IF EXISTS "family_members: read same family" ON public.family_members;
DROP POLICY IF EXISTS "family_members: read family peers" ON public.family_members;

-- Step 3: New policy — read own rows + all members of families you belong to
CREATE POLICY "family_members: read own and peers"
  ON public.family_members FOR SELECT
  USING (
    user_id = auth.uid()
    OR family_id IN (SELECT public.get_my_family_ids())
  );
