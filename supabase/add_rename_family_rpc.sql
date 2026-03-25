-- RPC: rename a family (SECURITY DEFINER bypasses RLS)
CREATE OR REPLACE FUNCTION public.rename_family(target_family_id UUID, new_name TEXT)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.families SET name = new_name WHERE id = target_family_id;
END;
$$;
