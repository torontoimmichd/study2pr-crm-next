-- Meta template names use lowercase letters, numbers and underscores.
update public.wa_templates set name = 'lead_ack_d0'
where name = 'LEAD_ACK_D0' and status = 'pending';

update public.wa_templates set name = 'lead_fu_checkin'
where name = 'LEAD_FU_CHECKIN' and status = 'pending';

update public.wa_templates set name = 'lead_assessment_next_step'
where name = 'LEAD_ASSESSMENT_NEXT_STEP' and status = 'pending';
