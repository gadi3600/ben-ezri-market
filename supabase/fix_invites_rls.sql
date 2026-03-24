-- Allow anyone (including anon/unauthenticated) to read invites by ID
-- This is needed for the /join page to load invite details
DROP POLICY IF EXISTS "invites: public read" ON public.invites;
CREATE POLICY "invites: public read"
  ON public.invites FOR SELECT
  USING (true);

-- Also allow reading families for the join page
DROP POLICY IF EXISTS "families: public read" ON public.families;
CREATE POLICY "families: public read"
  ON public.families FOR SELECT
  USING (true);
