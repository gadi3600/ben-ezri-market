-- Add last_seen_at to users
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ;

-- Update RPC to return last_seen_at instead of auth.last_sign_in_at
CREATE OR REPLACE FUNCTION public.get_all_users_admin()
RETURNS TABLE (
  id UUID,
  full_name TEXT,
  email TEXT,
  is_superadmin BOOLEAN,
  created_at TIMESTAMPTZ,
  last_sign_in TIMESTAMPTZ,
  family_memberships JSON
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    u.id,
    u.full_name,
    au.email,
    u.is_superadmin,
    u.created_at,
    COALESCE(u.last_seen_at, au.last_sign_in_at) as last_sign_in,
    COALESCE(
      (SELECT json_agg(json_build_object(
        'family_id', fm.family_id,
        'family_name', f.name,
        'role', fm.role
      ))
      FROM public.family_members fm
      JOIN public.families f ON f.id = fm.family_id
      WHERE fm.user_id = u.id),
      '[]'::json
    ) as family_memberships
  FROM public.users u
  JOIN auth.users au ON au.id = u.id
  ORDER BY u.created_at DESC;
$$;
