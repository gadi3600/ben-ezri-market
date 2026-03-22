-- ============================================================
-- Optimize RLS performance for list_items
-- The current policies do nested EXISTS + function calls per row.
-- Add index to speed up the join.
-- ============================================================

-- Index for the RLS join: list_items.list_id → shopping_lists.id → family_id
CREATE INDEX IF NOT EXISTS idx_shopping_lists_id_family
  ON public.shopping_lists(id, family_id);

-- Index for user lookup in is_family_member()
CREATE INDEX IF NOT EXISTS idx_users_id_family
  ON public.users(id, family_id);

-- Index for user lookup in is_family_admin()
CREATE INDEX IF NOT EXISTS idx_users_id_family_role
  ON public.users(id, family_id, role);
