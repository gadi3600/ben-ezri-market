-- ============================================================
-- family_members: many-to-many user ↔ family relationship
-- Replaces users.family_id as source of truth
-- ============================================================

-- 1. Create table
CREATE TABLE IF NOT EXISTS public.family_members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  family_id UUID NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('admin', 'member', 'viewer')),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, family_id)
);

-- 2. Migrate existing data from users.family_id
INSERT INTO public.family_members (user_id, family_id, role)
SELECT id, family_id, COALESCE(role, 'member')
FROM public.users
WHERE family_id IS NOT NULL
ON CONFLICT (user_id, family_id) DO NOTHING;

-- 3. Indexes
CREATE INDEX IF NOT EXISTS idx_family_members_user ON public.family_members(user_id);
CREATE INDEX IF NOT EXISTS idx_family_members_family ON public.family_members(family_id);
CREATE INDEX IF NOT EXISTS idx_family_members_user_family ON public.family_members(user_id, family_id);

-- 4. RLS
ALTER TABLE public.family_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "family_members: read own families"
  ON public.family_members FOR SELECT
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.family_members fm
      WHERE fm.user_id = auth.uid() AND fm.family_id = family_members.family_id
    )
  );

CREATE POLICY "family_members: superadmin all"
  ON public.family_members FOR ALL
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

CREATE POLICY "family_members: admin manage"
  ON public.family_members FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.family_members fm
      WHERE fm.user_id = auth.uid() AND fm.family_id = family_members.family_id AND fm.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.family_members fm
      WHERE fm.user_id = auth.uid() AND fm.family_id = family_members.family_id AND fm.role = 'admin'
    )
  );

-- 5. Update handle_new_auth_user trigger to also insert into family_members
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invite RECORD;
BEGIN
  SELECT * INTO v_invite
  FROM public.invites
  WHERE lower(email) = lower(NEW.email)
  LIMIT 1;

  IF v_invite.id IS NOT NULL THEN
    INSERT INTO public.users (id, full_name, avatar_url, role, family_id)
    VALUES (
      NEW.id,
      COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
      NEW.raw_user_meta_data->>'avatar_url',
      v_invite.role,
      v_invite.family_id
    );
    -- Also insert into family_members
    INSERT INTO public.family_members (user_id, family_id, role)
    VALUES (NEW.id, v_invite.family_id, v_invite.role)
    ON CONFLICT (user_id, family_id) DO NOTHING;

    DELETE FROM public.invites WHERE id = v_invite.id;
  ELSE
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
