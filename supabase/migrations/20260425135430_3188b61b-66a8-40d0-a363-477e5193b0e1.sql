ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS is_template boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS template_name text,
  ADD COLUMN IF NOT EXISTS template_category text,
  ADD COLUMN IF NOT EXISTS template_variables text[] DEFAULT '{}'::text[];

CREATE INDEX IF NOT EXISTS idx_messages_is_template ON public.messages (is_template) WHERE is_template = true;
CREATE INDEX IF NOT EXISTS idx_messages_template_category ON public.messages (template_category) WHERE is_template = true;

COMMENT ON COLUMN public.messages.is_template IS 'When true, this row is a reusable template, not an actual sent/received message';
COMMENT ON COLUMN public.messages.template_variables IS 'List of merge tag names available in body, e.g. {client_name, case_code, due_date}';