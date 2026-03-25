-- RPC: get admin email for each family (SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.get_family_admins()
RETURNS TABLE (
  family_id UUID,
  email TEXT
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT fm.family_id, au.email
  FROM public.family_members fm
  JOIN auth.users au ON au.id = fm.user_id
  WHERE fm.role = 'admin';
$$;
