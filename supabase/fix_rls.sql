-- ============================================================
-- תיקון RLS — פונקציות ליצירת/הצטרפות למשפחה
-- ============================================================
-- הרץ קובץ זה ב-Supabase SQL Editor

-- ============================================================
-- הסבר הבעיה:
--
-- 1. יצירת משפחה: INSERT + .select() נכשל כי ה-SELECT policy
--    דורש is_family_member(id) — אבל המשתמש עדיין לא חבר!
--
-- 2. הצטרפות עם קוד: SELECT לפי invite_code נכשל כי
--    is_family_member(id) מחזיר false לכל המשפחות.
--
-- הפתרון: פונקציות SECURITY DEFINER שעושות הכל atomically
--   ועוקפות RLS באופן מבוקר.
-- ============================================================


-- ── 1. create_family ─────────────────────────────────────────
-- יוצרת משפחה חדשה ומגדירה את המשתמש כ-admin בפעולה אחת

CREATE OR REPLACE FUNCTION public.create_family(family_name TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_family_id UUID;
BEGIN
  -- ולידציה
  IF trim(family_name) = '' THEN
    RAISE EXCEPTION 'שם המשפחה לא יכול להיות ריק';
  END IF;

  -- וודא שהמשתמש מחובר
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'יש להתחבר תחילה';
  END IF;

  -- וודא שהמשתמש לא כבר שייך למשפחה
  IF (SELECT family_id FROM public.users WHERE id = auth.uid()) IS NOT NULL THEN
    RAISE EXCEPTION 'המשתמש כבר שייך למשפחה';
  END IF;

  -- צור את המשפחה
  INSERT INTO public.families (name)
  VALUES (trim(family_name))
  RETURNING id INTO new_family_id;

  -- עדכן את המשתמש לadmin
  UPDATE public.users
  SET family_id = new_family_id,
      role = 'admin'
  WHERE id = auth.uid();

  RETURN new_family_id;
END;
$$;

-- הרשאות: כל משתמש מחובר יכול לקרוא לפונקציה
GRANT EXECUTE ON FUNCTION public.create_family(TEXT) TO authenticated;


-- ── 2. join_family ───────────────────────────────────────────
-- מצטרף למשפחה קיימת לפי קוד הזמנה

CREATE OR REPLACE FUNCTION public.join_family(p_invite_code TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_family_id UUID;
BEGIN
  -- ולידציה
  IF trim(p_invite_code) = '' THEN
    RAISE EXCEPTION 'קוד הזמנה לא יכול להיות ריק';
  END IF;

  -- וודא שהמשתמש מחובר
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'יש להתחבר תחילה';
  END IF;

  -- וודא שהמשתמש לא כבר שייך למשפחה
  IF (SELECT family_id FROM public.users WHERE id = auth.uid()) IS NOT NULL THEN
    RAISE EXCEPTION 'המשתמש כבר שייך למשפחה';
  END IF;

  -- חפש את המשפחה לפי קוד ההזמנה (case-insensitive)
  SELECT id INTO target_family_id
  FROM public.families
  WHERE lower(invite_code) = lower(trim(p_invite_code));

  IF target_family_id IS NULL THEN
    RAISE EXCEPTION 'קוד הזמנה לא נמצא — בדוק שוב';
  END IF;

  -- עדכן את המשתמש לmember
  UPDATE public.users
  SET family_id = target_family_id,
      role = 'member'
  WHERE id = auth.uid();

  RETURN target_family_id;
END;
$$;

-- הרשאות
GRANT EXECUTE ON FUNCTION public.join_family(TEXT) TO authenticated;


-- ============================================================
-- בדיקה (אופציונלי — הרץ אחרי שמחובר):
--   SELECT create_family('משפחת בן עזרי');
--   SELECT join_family('abcd1234');
-- ============================================================
