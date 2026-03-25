-- RPC: leave a family (SECURITY DEFINER bypasses RLS)
CREATE OR REPLACE FUNCTION public.leave_family(target_family_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.family_members
  WHERE user_id = auth.uid() AND family_id = target_family_id;
END;
$$;
