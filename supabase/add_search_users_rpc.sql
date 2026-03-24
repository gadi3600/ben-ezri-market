-- RPC to search users by name or email (superadmin only)
-- Joins public.users with auth.users to get email
CREATE OR REPLACE FUNCTION public.search_users(query TEXT)
RETURNS TABLE (
  id UUID,
  full_name TEXT,
  email TEXT
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT u.id, u.full_name, au.email
  FROM public.users u
  JOIN auth.users au ON au.id = u.id
  WHERE u.full_name ILIKE '%' || query || '%'
     OR au.email ILIKE '%' || query || '%'
  LIMIT 10;
$$;
