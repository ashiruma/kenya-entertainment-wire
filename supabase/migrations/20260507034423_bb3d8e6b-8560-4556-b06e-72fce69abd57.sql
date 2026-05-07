
-- Legends roster + daily features
CREATE TABLE public.legends (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  country text,
  era text,
  field text,
  short_bio text,
  impact text,
  image_url text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.legends ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Legends readable by all"
  ON public.legends FOR SELECT
  USING (true);

CREATE POLICY "Editors manage legends"
  ON public.legends FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'editor'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'editor'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_legends_updated
  BEFORE UPDATE ON public.legends
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TABLE public.legend_features (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  legend_id uuid NOT NULL REFERENCES public.legends(id) ON DELETE CASCADE,
  feature_date date NOT NULL UNIQUE,
  headline text NOT NULL,
  tribute text NOT NULL,
  hero_image_url text,
  draft_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.legend_features ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Legend features readable by all"
  ON public.legend_features FOR SELECT
  USING (true);

CREATE POLICY "Editors manage legend features"
  ON public.legend_features FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'editor'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'editor'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_legend_features_date ON public.legend_features(feature_date DESC);
