-- RPC: delete a family and all its data
-- SECURITY DEFINER bypasses RLS
CREATE OR REPLACE FUNCTION public.delete_family(target_family_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Delete in order to respect FK constraints
  DELETE FROM public.list_items WHERE list_id IN (
    SELECT id FROM public.shopping_lists WHERE family_id = target_family_id
  );
  DELETE FROM public.purchase_items WHERE purchase_id IN (
    SELECT id FROM public.purchases WHERE family_id = target_family_id
  );
  DELETE FROM public.purchase_receipts WHERE purchase_id IN (
    SELECT id FROM public.purchases WHERE family_id = target_family_id
  );
  DELETE FROM public.shopping_lists WHERE family_id = target_family_id;
  DELETE FROM public.purchases WHERE family_id = target_family_id;
  DELETE FROM public.stores WHERE family_id = target_family_id;
  DELETE FROM public.invites WHERE family_id = target_family_id;
  DELETE FROM public.family_members WHERE family_id = target_family_id;
  DELETE FROM public.families WHERE id = target_family_id;
  RETURN TRUE;
END;
$$;
