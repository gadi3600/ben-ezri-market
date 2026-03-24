-- Allow superadmin to manage invites for ALL families
DROP POLICY IF EXISTS "invites: superadmin manage all" ON public.invites;
CREATE POLICY "invites: superadmin manage all"
  ON public.invites FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.is_superadmin = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.is_superadmin = true
    )
  );
