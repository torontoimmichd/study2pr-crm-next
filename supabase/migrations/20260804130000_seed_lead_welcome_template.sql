-- Keep the production welcome template explicit and inactive until Meta approves
-- the matching WhatsApp template name. The outbound worker will wait safely.

insert into public.wa_templates (org_id, name, language, body, category, status)
select public.default_org_id(),
       'LEAD_ACK_D0',
       'en_US',
       'Hi, thank you for contacting Study2PR. We received your enquiry and will contact you shortly.',
       'utility',
       'pending'
where not exists (
  select 1
  from public.wa_templates
  where org_id = public.default_org_id()
    and name = 'LEAD_ACK_D0'
    and language = 'en_US'
);
