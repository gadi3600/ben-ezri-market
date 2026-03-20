-- ============================================================
-- בן עזרי מרקט — Database Schema
-- ============================================================
-- הרצה ב-Supabase SQL Editor לפי הסדר הזה

-- ============================================================
-- 0. EXTENSIONS
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";


-- ============================================================
-- 1. TABLES
-- ============================================================

-- ── families ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.families (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name       TEXT NOT NULL,
  invite_code TEXT UNIQUE DEFAULT substr(md5(random()::text), 1, 8),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── users (extends auth.users) ───────────────────────────────
CREATE TABLE IF NOT EXISTS public.users (
  id         UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  family_id  UUID REFERENCES public.families(id) ON DELETE SET NULL,
  full_name  TEXT NOT NULL DEFAULT '',
  avatar_url TEXT,
  role       TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── stores ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.stores (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name       TEXT NOT NULL,
  logo_url   TEXT,
  website    TEXT,
  is_active  BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── products ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.products (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  family_id        UUID REFERENCES public.families(id) ON DELETE CASCADE,
  name             TEXT NOT NULL,
  barcode          TEXT,
  category         TEXT DEFAULT 'כללי',
  default_unit     TEXT DEFAULT 'יחידה',
  default_quantity NUMERIC(10,2) DEFAULT 1,
  image_url        TEXT,
  notes            TEXT,
  is_global        BOOLEAN NOT NULL DEFAULT false,   -- true = זמין לכולם
  created_by       UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── shopping_lists ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.shopping_lists (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  family_id   UUID NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  name        TEXT NOT NULL DEFAULT 'רשימת קניות',
  status      TEXT NOT NULL DEFAULT 'active'
              CHECK (status IN ('active', 'shopping', 'completed', 'archived')),
  store_id    UUID REFERENCES public.stores(id) ON DELETE SET NULL,
  created_by  UUID REFERENCES public.users(id) ON DELETE SET NULL,
  completed_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── list_items ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.list_items (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  list_id     UUID NOT NULL REFERENCES public.shopping_lists(id) ON DELETE CASCADE,
  product_id  UUID REFERENCES public.products(id) ON DELETE SET NULL,
  name        TEXT NOT NULL,                        -- snapshot של שם המוצר
  quantity    NUMERIC(10,2) NOT NULL DEFAULT 1,
  unit        TEXT NOT NULL DEFAULT 'יחידה',
  note        TEXT,
  is_checked  BOOLEAN NOT NULL DEFAULT false,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  added_by    UUID REFERENCES public.users(id) ON DELETE SET NULL,
  checked_by  UUID REFERENCES public.users(id) ON DELETE SET NULL,
  checked_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── purchases ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.purchases (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  family_id     UUID NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  store_id      UUID REFERENCES public.stores(id) ON DELETE SET NULL,
  list_id       UUID REFERENCES public.shopping_lists(id) ON DELETE SET NULL,
  total_amount  NUMERIC(10,2),
  purchased_by  UUID REFERENCES public.users(id) ON DELETE SET NULL,
  receipt_url   TEXT,
  notes         TEXT,
  purchased_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── purchase_items ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.purchase_items (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  purchase_id     UUID NOT NULL REFERENCES public.purchases(id) ON DELETE CASCADE,
  product_id      UUID REFERENCES public.products(id) ON DELETE SET NULL,
  name            TEXT NOT NULL,                    -- snapshot של שם המוצר
  quantity        NUMERIC(10,2) NOT NULL DEFAULT 1,
  unit            TEXT NOT NULL DEFAULT 'יחידה',
  price_per_unit  NUMERIC(10,2),
  total_price     NUMERIC(10,2),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);


-- ============================================================
-- 2. INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_users_family_id           ON public.users(family_id);
CREATE INDEX IF NOT EXISTS idx_products_family_id        ON public.products(family_id);
CREATE INDEX IF NOT EXISTS idx_products_barcode          ON public.products(barcode) WHERE barcode IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_shopping_lists_family_id  ON public.shopping_lists(family_id);
CREATE INDEX IF NOT EXISTS idx_shopping_lists_status     ON public.shopping_lists(status);
CREATE INDEX IF NOT EXISTS idx_list_items_list_id        ON public.list_items(list_id);
CREATE INDEX IF NOT EXISTS idx_list_items_is_checked     ON public.list_items(is_checked);
CREATE INDEX IF NOT EXISTS idx_purchases_family_id       ON public.purchases(family_id);
CREATE INDEX IF NOT EXISTS idx_purchases_purchased_at    ON public.purchases(purchased_at DESC);
CREATE INDEX IF NOT EXISTS idx_purchase_items_purchase_id ON public.purchase_items(purchase_id);


-- ============================================================
-- 3. HELPER FUNCTIONS
-- ============================================================

-- מחזיר את family_id של המשתמש המחובר
CREATE OR REPLACE FUNCTION public.get_my_family_id()
RETURNS UUID
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT family_id FROM public.users WHERE id = auth.uid() LIMIT 1;
$$;

-- בדיקה האם המשתמש המחובר שייך למשפחה מסוימת
CREATE OR REPLACE FUNCTION public.is_family_member(fam_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND family_id = fam_id
  );
$$;

-- בדיקה האם המשתמש המחובר הוא admin של משפחה מסוימת
CREATE OR REPLACE FUNCTION public.is_family_admin(fam_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND family_id = fam_id AND role = 'admin'
  );
$$;

-- trigger לעדכון updated_at אוטומטי
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- trigger אוטומטי: יוצר רשומת user בטבלה שלנו כשנרשם
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (id, full_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$;


-- ============================================================
-- 4. TRIGGERS
-- ============================================================

-- updated_at triggers
CREATE OR REPLACE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE TRIGGER trg_products_updated_at
  BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE TRIGGER trg_shopping_lists_updated_at
  BEFORE UPDATE ON public.shopping_lists
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE TRIGGER trg_list_items_updated_at
  BEFORE UPDATE ON public.list_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- auto-create user record on auth signup
DROP TRIGGER IF EXISTS trg_on_auth_user_created ON auth.users;
CREATE TRIGGER trg_on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();


-- ============================================================
-- 5. ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE public.families        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stores          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shopping_lists  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.list_items      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchases       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_items  ENABLE ROW LEVEL SECURITY;

-- ── families ─────────────────────────────────────────────────
CREATE POLICY "families: חברי המשפחה יכולים לקרוא"
  ON public.families FOR SELECT
  USING (public.is_family_member(id));

CREATE POLICY "families: כל משתמש מחובר יכול ליצור משפחה"
  ON public.families FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "families: רק admin יכול לעדכן"
  ON public.families FOR UPDATE
  USING (public.is_family_admin(id));

CREATE POLICY "families: רק admin יכול למחוק"
  ON public.families FOR DELETE
  USING (public.is_family_admin(id));

-- ── users ────────────────────────────────────────────────────
CREATE POLICY "users: חברי משפחה יכולים לראות אחד את השני"
  ON public.users FOR SELECT
  USING (
    id = auth.uid()
    OR (family_id IS NOT NULL AND public.is_family_member(family_id))
  );

CREATE POLICY "users: המשתמש יכול לעדכן את עצמו"
  ON public.users FOR UPDATE
  USING (id = auth.uid());

CREATE POLICY "users: insert דרך trigger בלבד"
  ON public.users FOR INSERT
  WITH CHECK (id = auth.uid());

-- ── stores ────────────────────────────────────────────────────
CREATE POLICY "stores: כל מחובר יכול לקרוא"
  ON public.stores FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "stores: רק service_role יכול לשנות"
  ON public.stores FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);  -- ניתן להגביל עוד בהמשך

-- ── products ─────────────────────────────────────────────────
CREATE POLICY "products: מוצרים גלובליים נגישים לכולם"
  ON public.products FOR SELECT
  USING (
    auth.uid() IS NOT NULL
    AND (
      is_global = true
      OR (family_id IS NOT NULL AND public.is_family_member(family_id))
    )
  );

CREATE POLICY "products: חברי משפחה יכולים להוסיף מוצרים"
  ON public.products FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND (
      is_global = false
      AND family_id = public.get_my_family_id()
    )
  );

CREATE POLICY "products: חברי משפחה יכולים לעדכן מוצרי משפחה"
  ON public.products FOR UPDATE
  USING (
    family_id IS NOT NULL
    AND public.is_family_member(family_id)
  );

CREATE POLICY "products: חברי משפחה יכולים למחוק מוצרי משפחה"
  ON public.products FOR DELETE
  USING (
    family_id IS NOT NULL
    AND public.is_family_member(family_id)
  );

-- ── shopping_lists ────────────────────────────────────────────
CREATE POLICY "shopping_lists: חברי משפחה יכולים לקרוא"
  ON public.shopping_lists FOR SELECT
  USING (public.is_family_member(family_id));

CREATE POLICY "shopping_lists: חברי משפחה יכולים ליצור"
  ON public.shopping_lists FOR INSERT
  WITH CHECK (
    family_id = public.get_my_family_id()
    AND auth.uid() IS NOT NULL
  );

CREATE POLICY "shopping_lists: חברי משפחה יכולים לעדכן"
  ON public.shopping_lists FOR UPDATE
  USING (public.is_family_member(family_id));

CREATE POLICY "shopping_lists: admin יכול למחוק"
  ON public.shopping_lists FOR DELETE
  USING (public.is_family_admin(family_id));

-- ── list_items ────────────────────────────────────────────────
CREATE POLICY "list_items: חברי משפחה יכולים לקרוא"
  ON public.list_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.shopping_lists sl
      WHERE sl.id = list_id
        AND public.is_family_member(sl.family_id)
    )
  );

CREATE POLICY "list_items: חברי משפחה יכולים להוסיף"
  ON public.list_items FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.shopping_lists sl
      WHERE sl.id = list_id
        AND public.is_family_member(sl.family_id)
    )
  );

CREATE POLICY "list_items: חברי משפחה יכולים לעדכן"
  ON public.list_items FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.shopping_lists sl
      WHERE sl.id = list_id
        AND public.is_family_member(sl.family_id)
    )
  );

CREATE POLICY "list_items: חברי משפחה יכולים למחוק"
  ON public.list_items FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.shopping_lists sl
      WHERE sl.id = list_id
        AND public.is_family_member(sl.family_id)
    )
  );

-- ── purchases ─────────────────────────────────────────────────
CREATE POLICY "purchases: חברי משפחה יכולים לקרוא"
  ON public.purchases FOR SELECT
  USING (public.is_family_member(family_id));

CREATE POLICY "purchases: חברי משפחה יכולים ליצור"
  ON public.purchases FOR INSERT
  WITH CHECK (
    family_id = public.get_my_family_id()
    AND auth.uid() IS NOT NULL
  );

CREATE POLICY "purchases: המבצע יכול לעדכן"
  ON public.purchases FOR UPDATE
  USING (
    purchased_by = auth.uid()
    OR public.is_family_admin(family_id)
  );

CREATE POLICY "purchases: admin יכול למחוק"
  ON public.purchases FOR DELETE
  USING (public.is_family_admin(family_id));

-- ── purchase_items ────────────────────────────────────────────
CREATE POLICY "purchase_items: חברי משפחה יכולים לקרוא"
  ON public.purchase_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.purchases p
      WHERE p.id = purchase_id
        AND public.is_family_member(p.family_id)
    )
  );

CREATE POLICY "purchase_items: חברי משפחה יכולים להוסיף"
  ON public.purchase_items FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.purchases p
      WHERE p.id = purchase_id
        AND public.is_family_member(p.family_id)
    )
  );

CREATE POLICY "purchase_items: חברי משפחה יכולים לעדכן"
  ON public.purchase_items FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.purchases p
      WHERE p.id = purchase_id
        AND public.is_family_member(p.family_id)
    )
  );

CREATE POLICY "purchase_items: admin יכול למחוק"
  ON public.purchase_items FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.purchases p
      WHERE p.id = purchase_id
        AND public.is_family_admin(p.family_id)
    )
  );


-- ============================================================
-- 6. SEED DATA — חנויות ברירת מחדל
-- ============================================================

INSERT INTO public.stores (id, name, logo_url, website) VALUES
  (
    'a1000000-0000-0000-0000-000000000001',
    'רמי לוי',
    NULL,
    'https://www.rami-levy.co.il'
  ),
  (
    'a1000000-0000-0000-0000-000000000002',
    'מעיין 2000',
    NULL,
    NULL
  ),
  (
    'a1000000-0000-0000-0000-000000000003',
    'סופר ספיר',
    NULL,
    NULL
  ),
  (
    'a1000000-0000-0000-0000-000000000004',
    'אינגליש קייק',
    NULL,
    'https://www.englishcake.co.il'
  )
ON CONFLICT (id) DO NOTHING;


-- ============================================================
-- 7. VIEWS (שימושיות)
-- ============================================================

-- רשימות קניות פעילות עם כמות פריטים וסטטוס
CREATE OR REPLACE VIEW public.v_active_lists AS
SELECT
  sl.id,
  sl.family_id,
  sl.name,
  sl.status,
  sl.store_id,
  s.name          AS store_name,
  sl.created_by,
  u.full_name     AS created_by_name,
  sl.created_at,
  sl.updated_at,
  COUNT(li.id)                                    AS total_items,
  COUNT(li.id) FILTER (WHERE li.is_checked)       AS checked_items
FROM public.shopping_lists sl
LEFT JOIN public.stores s  ON s.id  = sl.store_id
LEFT JOIN public.users  u  ON u.id  = sl.created_by
LEFT JOIN public.list_items li ON li.list_id = sl.id
WHERE sl.status IN ('active', 'shopping')
GROUP BY sl.id, s.name, u.full_name;

-- היסטוריית קניות עם סכום כולל
CREATE OR REPLACE VIEW public.v_purchase_history AS
SELECT
  p.id,
  p.family_id,
  p.store_id,
  s.name          AS store_name,
  p.purchased_by,
  u.full_name     AS purchased_by_name,
  p.total_amount,
  p.purchased_at,
  COUNT(pi.id)    AS item_count
FROM public.purchases p
LEFT JOIN public.stores s  ON s.id = p.store_id
LEFT JOIN public.users  u  ON u.id = p.purchased_by
LEFT JOIN public.purchase_items pi ON pi.purchase_id = p.id
GROUP BY p.id, s.name, u.full_name
ORDER BY p.purchased_at DESC;


-- ============================================================
-- סיום — Schema מוכן לשימוש
-- ============================================================
