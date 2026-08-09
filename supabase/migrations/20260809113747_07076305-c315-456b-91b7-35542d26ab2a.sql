-- 1. drafts: stop leaking unpublished drafts to every logged-in user
DROP POLICY IF EXISTS "Public reads published drafts" ON public.drafts;

CREATE POLICY "Anyone reads published articles"
ON public.drafts FOR SELECT
TO anon, authenticated
USING (status = 'published');

CREATE POLICY "Authors and editors read their drafts"
ON public.drafts FOR SELECT
TO authenticated
USING (
  auth.uid() = author_id
  OR public.has_role(auth.uid(), 'editor'::app_role)
  OR public.has_role(auth.uid(), 'admin'::app_role)
);

-- 2. profiles: no anonymous access to user identities
DROP POLICY IF EXISTS "Profiles readable by all" ON public.profiles;

CREATE POLICY "Authenticated users read profiles"
ON public.profiles FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "Users insert own profile" ON public.profiles;
CREATE POLICY "Users insert own profile"
ON public.profiles FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users update own profile" ON public.profiles;
CREATE POLICY "Users update own profile"
ON public.profiles FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

REVOKE SELECT ON public.profiles FROM anon;

-- 3. SECURITY DEFINER trigger functions must not be callable via the API
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.update_updated_at() FROM PUBLIC, anon, authenticated;