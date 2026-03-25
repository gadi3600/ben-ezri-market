-- RPC: create family + add creator as admin in one transaction
-- Returns the new family_id
CREATE OR REPLACE FUNCTION public.create_family_with_admin(family_name TEXT)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_family_id UUID;
BEGIN
  -- Create family
  INSERT INTO public.families (name)
  VALUES (family_name)
  RETURNING id INTO new_family_id;

  -- Add creator as admin
  INSERT INTO public.family_members (user_id, family_id, role)
  VALUES (auth.uid(), new_family_id, 'admin');

  RETURN new_family_id;
END;
$$;
