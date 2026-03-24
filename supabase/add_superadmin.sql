-- Add superadmin flag
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS is_superadmin BOOLEAN DEFAULT false;

-- Set gadi3600@gmail.com as superadmin
UPDATE public.users SET is_superadmin = true
WHERE id = (SELECT id FROM auth.users WHERE email = 'gadi3600@gmail.com' LIMIT 1);

-- Allow superadmin to read all families
DROP POLICY IF EXISTS "families: superadmin read all" ON public.families;
CREATE POLICY "families: superadmin read all"
  ON public.families FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.is_superadmin = true
    )
  );

-- Allow superadmin to create families
DROP POLICY IF EXISTS "families: superadmin create" ON public.families;
CREATE POLICY "families: superadmin create"
  ON public.families FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.is_superadmin = true
    )
  );

-- Allow superadmin to read all users (for viewing other families)
DROP POLICY IF EXISTS "users: superadmin read all" ON public.users;
CREATE POLICY "users: superadmin read all"
  ON public.users FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.is_superadmin = true
    )
  );

-- Allow superadmin to read all list data
DROP POLICY IF EXISTS "shopping_lists: superadmin read" ON public.shopping_lists;
CREATE POLICY "shopping_lists: superadmin read"
  ON public.shopping_lists FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.is_superadmin = true
    )
  );

DROP POLICY IF EXISTS "list_items: superadmin read" ON public.list_items;
CREATE POLICY "list_items: superadmin read"
  ON public.list_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.is_superadmin = true
    )
  );
