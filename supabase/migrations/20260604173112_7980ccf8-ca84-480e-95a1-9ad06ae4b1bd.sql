CREATE TABLE public.approval_audit_log (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  draft_id uuid NOT NULL,
  actor_user_id uuid NOT NULL,
  actor_display_name text,
  action text NOT NULL,
  from_status text,
  to_status text,
  validation_errors jsonb NOT NULL DEFAULT '[]'::jsonb,
  validation_warnings jsonb NOT NULL DEFAULT '[]'::jsonb,
  error_count integer NOT NULL DEFAULT 0,
  warning_count integer NOT NULL DEFAULT 0,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.approval_audit_log TO authenticated;
GRANT ALL ON public.approval_audit_log TO service_role;

ALTER TABLE public.approval_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated insert audit"
  ON public.approval_audit_log FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = actor_user_id);

CREATE POLICY "Editors and admins view all audit"
  ON public.approval_audit_log FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'editor'::app_role) OR has_role(auth.uid(), 'admin'::app_role) OR actor_user_id = auth.uid());

CREATE INDEX approval_audit_log_draft_idx ON public.approval_audit_log(draft_id, created_at DESC);