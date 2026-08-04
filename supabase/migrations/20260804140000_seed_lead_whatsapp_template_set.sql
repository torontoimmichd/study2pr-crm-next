-- Three human, low-pressure templates for the lead journey.
-- They remain pending until the matching Meta templates are approved.

update public.wa_templates
set body = 'Hi {{1}}, thank you for reaching out to Study2PR. We are glad you connected with us. We will review your details carefully and help you understand the most realistic next step. When would be a comfortable time for a short call?',
    category = 'utility',
    status = case when status = 'approved' then status else 'pending' end
where name = 'LEAD_ACK_D0' and language = 'en_US';

insert into public.wa_templates (org_id, name, language, body, category, status)
select public.default_org_id(), v.name, 'en_US', v.body, 'utility', 'pending'
from (values
  ('LEAD_FU_CHECKIN', 'Hi {{1}}, just checking in gently. Immigration planning can feel like a lot at first, so please take your time. We are here to help you understand your options clearly and avoid mistakes. Is there one question we can answer for you today?'),
  ('LEAD_ASSESSMENT_NEXT_STEP', 'Hi {{1}}, thank you for speaking with us. Your education, work experience, language scores and family plans help us assess your options responsibly. When would be a convenient time to complete the next step together?')
) as v(name, body)
where not exists (
  select 1 from public.wa_templates t
  where t.org_id = public.default_org_id()
    and t.name = v.name
    and t.language = 'en_US'
);

-- Internal queue aliases: four scheduled touchpoints use one approved Meta
-- template, so the business does not maintain four nearly identical messages.
insert into public.messages (
  channel, direction, body, is_template, template_name,
  template_category, template_variables, status, sent_at
)
select 'whatsapp', 'outbound', v.body, true, v.name,
       'lead_nurture', array['first_name'], 'active', null
from (values
  ('LEAD_FU_D2', 'Hi {{first_name}}, just checking in gently. Immigration planning can feel like a lot at first, so please take your time. We are here to help you understand your options clearly and avoid mistakes. Is there one question we can answer for you today?'),
  ('LEAD_FU_D4', 'Hi {{first_name}}, just checking in gently. Immigration planning can feel like a lot at first, so please take your time. We are here to help you understand your options clearly and avoid mistakes. Is there one question we can answer for you today?'),
  ('LEAD_FU_D6', 'Hi {{first_name}}, just checking in gently. Immigration planning can feel like a lot at first, so please take your time. We are here to help you understand your options clearly and avoid mistakes. Is there one question we can answer for you today?'),
  ('LEAD_FU_D10', 'Hi {{first_name}}, just checking in gently. Immigration planning can feel like a lot at first, so please take your time. We are here to help you understand your options clearly and avoid mistakes. Is there one question we can answer for you today?')
) as v(name, body)
where not exists (
  select 1 from public.messages m
  where m.is_template and m.template_name = v.name and m.status = 'active'
);
