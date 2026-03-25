-- ============================================================
-- Superadmin Dashboard RPC functions
-- ============================================================

-- 1. System statistics
CREATE OR REPLACE FUNCTION public.get_system_stats()
RETURNS JSON
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT json_build_object(
    'total_users', (SELECT COUNT(*) FROM public.users),
    'total_families', (SELECT COUNT(*) FROM public.families),
    'total_items_purchased', (SELECT COUNT(*) FROM public.purchase_items),
    'total_shopping_lists', (SELECT COUNT(*) FROM public.shopping_lists)
  );
$$;

-- 2. All users with email, families, last sign in
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
    au.last_sign_in_at as last_sign_in,
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

-- 3. Delete user completely
CREATE OR REPLACE FUNCTION public.admin_delete_user(target_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Remove from all families
  DELETE FROM public.family_members WHERE user_id = target_user_id;
  -- Remove push subscriptions
  DELETE FROM public.push_subscriptions WHERE user_id = target_user_id;
  -- Remove from public.users
  DELETE FROM public.users WHERE id = target_user_id;
  -- Remove from auth.users (this cascades)
  DELETE FROM auth.users WHERE id = target_user_id;
  RETURN TRUE;
END;
$$;

-- 4. Change user role in a specific family
CREATE OR REPLACE FUNCTION public.admin_change_role(
  target_user_id UUID,
  target_family_id UUID,
  new_role TEXT
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.family_members
  SET role = new_role
  WHERE user_id = target_user_id AND family_id = target_family_id;
END;
$$;
