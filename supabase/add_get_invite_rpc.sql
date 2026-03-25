-- RPC: get invite by ID (public, no auth required)
-- SECURITY DEFINER bypasses RLS so unauthenticated users can read invites
CREATE OR REPLACE FUNCTION public.get_invite_by_token(invite_token UUID)
RETURNS TABLE (
  id UUID,
  email TEXT,
  role TEXT,
  family_id UUID,
  family_name TEXT
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    i.id,
    i.email,
    i.role,
    i.family_id,
    COALESCE(f.name, 'משפחה') as family_name
  FROM public.invites i
  JOIN public.families f ON f.id = i.family_id
  WHERE i.id = invite_token;
$$;
