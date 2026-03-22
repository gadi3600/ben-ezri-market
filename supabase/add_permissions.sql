-- ============================================================
-- 1. Add 'viewer' to role CHECK constraint
-- ============================================================

ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE public.users ADD CONSTRAINT users_role_check
  CHECK (role IN ('admin', 'member', 'viewer'));

-- ============================================================
-- 2. Create invites table
-- ============================================================

CREATE TABLE IF NOT EXISTS public.invites (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email      TEXT NOT NULL,
  role       TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member', 'viewer')),
  invited_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  family_id  UUID NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(email, family_id)
);

ALTER TABLE public.invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "invites: family admin can manage"
  ON public.invites FOR ALL
  USING (public.is_family_admin(family_id))
  WITH CHECK (public.is_family_admin(family_id));

-- ============================================================
-- 3. Helper: is_family_editor (admin or member, not viewer)
-- ============================================================

CREATE OR REPLACE FUNCTION public.is_family_editor(fam_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
      AND family_id = fam_id
      AND role IN ('admin', 'member')
  );
$$;

-- ============================================================
-- 4. Update trigger to auto-assign role from invites
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invite RECORD;
BEGIN
  -- Check if there's a pending invite for this email
  SELECT * INTO v_invite
  FROM public.invites
  WHERE lower(email) = lower(NEW.email)
  LIMIT 1;

  IF v_invite.id IS NOT NULL THEN
    -- Insert user with invited role and family
    INSERT INTO public.users (id, full_name, avatar_url, role, family_id)
    VALUES (
      NEW.id,
      COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
      NEW.raw_user_meta_data->>'avatar_url',
      v_invite.role,
      v_invite.family_id
    );
    -- Delete the used invite
    DELETE FROM public.invites WHERE id = v_invite.id;
  ELSE
    -- Normal signup — no invite
    INSERT INTO public.users (id, full_name, avatar_url)
    VALUES (
      NEW.id,
      COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
      NEW.raw_user_meta_data->>'avatar_url'
    );
  END IF;

  RETURN NEW;
END;
$$;

-- ============================================================
-- 5. Allow admin to update roles of family members
-- ============================================================

CREATE POLICY "users: admin can update family members"
  ON public.users FOR UPDATE
  USING (
    family_id IS NOT NULL
    AND public.is_family_admin(family_id)
  );

-- ============================================================
-- 6. Set gadi3600@gmail.com as admin
-- ============================================================

UPDATE public.users
SET role = 'admin'
WHERE id = (
  SELECT id FROM auth.users WHERE email = 'gadi3600@gmail.com' LIMIT 1
);
