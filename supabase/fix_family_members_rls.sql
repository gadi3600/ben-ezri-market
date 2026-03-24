-- Fix family_members RLS: avoid self-referencing policies
-- Use a SECURITY DEFINER function to get user's families without RLS recursion

-- Helper function: get all family_ids for a user (bypasses RLS)
CREATE OR REPLACE FUNCTION public.get_my_family_ids()
RETURNS SETOF UUID
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT family_id FROM public.family_members WHERE user_id = auth.uid();
$$;

-- Drop old policies
DROP POLICY IF EXISTS "family_members: read own families" ON public.family_members;
DROP POLICY IF EXISTS "family_members: read own" ON public.family_members;
DROP POLICY IF EXISTS "family_members: read same family" ON public.family_members;
DROP POLICY IF EXISTS "family_members: read family peers" ON public.family_members;

-- New simple policies using the helper function
CREATE POLICY "family_members: read own and peers"
  ON public.family_members FOR SELECT
  USING (
    user_id = auth.uid()
    OR family_id IN (SELECT public.get_my_family_ids())
  );
