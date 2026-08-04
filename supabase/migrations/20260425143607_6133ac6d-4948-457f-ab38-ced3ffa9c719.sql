-- Add step type and due offset to step_templates
ALTER TABLE public.step_templates
  ADD COLUMN IF NOT EXISTS step_type text NOT NULL DEFAULT 'task',
  ADD COLUMN IF NOT EXISTS due_offset_days integer;

-- Add a CHECK-like via trigger would be over-engineering; values enforced at app layer.
COMMENT ON COLUMN public.step_templates.step_type IS 'task | document | email | wait | condition';
COMMENT ON COLUMN public.step_templates.due_offset_days IS 'Days from stage entry by which this step should complete';

-- Add status column to messages for sent log (sent/delivered/failed/queued)
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'sent',
  ADD COLUMN IF NOT EXISTS template_id uuid REFERENCES public.messages(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS last_edited_by uuid,
  ADD COLUMN IF NOT EXISTS last_edited_at timestamptz;

COMMENT ON COLUMN public.messages.status IS 'queued | sent | delivered | failed | bounced';
COMMENT ON COLUMN public.messages.template_id IS 'Reference to the template (also a messages row with is_template=true) used to compose this message';