-- Push notification subscriptions
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  family_id    UUID REFERENCES public.families(id) ON DELETE CASCADE,
  subscription JSONB NOT NULL,
  created_at   TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "push_subscriptions: users can manage own"
  ON public.push_subscriptions FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "push_subscriptions: service role full access"
  ON public.push_subscriptions FOR ALL
  USING (auth.uid() IS NOT NULL);
