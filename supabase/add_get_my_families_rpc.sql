-- RPC function to get current user's family memberships
-- SECURITY DEFINER bypasses RLS completely
CREATE OR REPLACE FUNCTION public.get_my_families()
RETURNS TABLE (
  id UUID,
  family_id UUID,
  role TEXT,
  family_name TEXT
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    fm.id,
    fm.family_id,
    fm.role,
    COALESCE(f.name, 'משפחה') as family_name
  FROM public.family_members fm
  JOIN public.families f ON f.id = fm.family_id
  WHERE fm.user_id = auth.uid();
$$;
