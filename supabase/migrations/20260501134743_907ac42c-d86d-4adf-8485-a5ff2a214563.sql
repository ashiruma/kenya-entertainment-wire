
-- Tighten discovered_stories policies
DROP POLICY IF EXISTS "Auth update stories" ON public.discovered_stories;
DROP POLICY IF EXISTS "Auth insert stories" ON public.discovered_stories;

CREATE POLICY "Writers insert stories" ON public.discovered_stories FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'writer') OR
    public.has_role(auth.uid(), 'editor') OR
    public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Writers update stories" ON public.discovered_stories FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'writer') OR
    public.has_role(auth.uid(), 'editor') OR
    public.has_role(auth.uid(), 'admin')
  );

-- Lock down SECURITY DEFINER functions
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.update_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
