CREATE TABLE public.newsroom_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

GRANT SELECT ON public.newsroom_settings TO authenticated;
GRANT ALL ON public.newsroom_settings TO service_role;

ALTER TABLE public.newsroom_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read newsroom settings"
  ON public.newsroom_settings FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can insert newsroom settings"
  ON public.newsroom_settings FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update newsroom settings"
  ON public.newsroom_settings FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete newsroom settings"
  ON public.newsroom_settings FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER newsroom_settings_updated_at
  BEFORE UPDATE ON public.newsroom_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

INSERT INTO public.newsroom_settings (key, value) VALUES ('min_word_count', '1600'::jsonb)
  ON CONFLICT (key) DO NOTHING;
