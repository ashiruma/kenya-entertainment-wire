
-- Roles enum and table
CREATE TYPE public.app_role AS ENUM ('admin', 'editor', 'writer');

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer to avoid recursive RLS
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Profiles policies
CREATE POLICY "Profiles readable by all" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);

-- user_roles policies
CREATE POLICY "Users view own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage roles" ON public.user_roles FOR ALL USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Discovered stories (news leads)
CREATE TABLE public.discovered_stories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  source TEXT NOT NULL,
  source_url TEXT NOT NULL UNIQUE,
  excerpt TEXT,
  image_url TEXT,
  category TEXT,
  region TEXT DEFAULT 'national',
  published_at TIMESTAMPTZ,
  raw_content TEXT,
  status TEXT NOT NULL DEFAULT 'new', -- new, used, skipped
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.discovered_stories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth view stories" ON public.discovered_stories FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth update stories" ON public.discovered_stories FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Auth insert stories" ON public.discovered_stories FOR INSERT TO authenticated WITH CHECK (true);

-- Drafts (AI-generated articles)
CREATE TABLE public.drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_story_id UUID REFERENCES public.discovered_stories(id) ON DELETE SET NULL,
  template_type TEXT NOT NULL DEFAULT 'breaking', -- breaking, event_preview, profile, review
  headline TEXT NOT NULL,
  lede TEXT,
  body TEXT,
  category TEXT,
  region TEXT DEFAULT 'national',
  hero_image_url TEXT,
  twitter_post TEXT,
  instagram_post TEXT,
  facebook_post TEXT,
  status TEXT NOT NULL DEFAULT 'draft', -- draft, review, published
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.drafts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public reads published drafts" ON public.drafts FOR SELECT USING (status = 'published' OR auth.uid() IS NOT NULL);
CREATE POLICY "Authors and editors insert drafts" ON public.drafts FOR INSERT TO authenticated WITH CHECK (auth.uid() = author_id);
CREATE POLICY "Owner or editor updates drafts" ON public.drafts FOR UPDATE TO authenticated USING (
  auth.uid() = author_id OR public.has_role(auth.uid(), 'editor') OR public.has_role(auth.uid(), 'admin')
);
CREATE POLICY "Owner or admin deletes drafts" ON public.drafts FOR DELETE TO authenticated USING (
  auth.uid() = author_id OR public.has_role(auth.uid(), 'admin')
);

-- Timestamp trigger
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER drafts_updated BEFORE UPDATE ON public.drafts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Auto-create profile + writer role on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)));
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'writer');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE INDEX idx_drafts_status ON public.drafts(status);
CREATE INDEX idx_drafts_author ON public.drafts(author_id);
CREATE INDEX idx_stories_status ON public.discovered_stories(status);
