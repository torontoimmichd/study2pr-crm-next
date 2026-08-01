


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE EXTENSION IF NOT EXISTS "pg_cron" WITH SCHEMA "pg_catalog";






CREATE EXTENSION IF NOT EXISTS "pg_net" WITH SCHEMA "extensions";






COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "btree_gin" WITH SCHEMA "public";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pg_trgm" WITH SCHEMA "public";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "unaccent" WITH SCHEMA "public";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE OR REPLACE FUNCTION "public"."app_settings_set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;


ALTER FUNCTION "public"."app_settings_set_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."auth_is_owner_or_admin"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select fn_is_owner_admin() $$;


ALTER FUNCTION "public"."auth_is_owner_or_admin"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."auth_is_staff"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select fn_is_staff() $$;


ALTER FUNCTION "public"."auth_is_staff"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."auth_role"() RETURNS "text"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select public.fn_current_role()
$$;


ALTER FUNCTION "public"."auth_role"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."auth_role"() IS 'Phase 2A: thin alias over fn_current_role(), which enforces is_active. Previously had a divergent copy of the role lookup that ignored is_active.';



CREATE OR REPLACE FUNCTION "public"."bulk_process_prospectives"("p_decisions" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_decision JSONB;
  v_id UUID;
  v_action TEXT;
  v_consent_count INT := 0;
  v_decline_count INT := 0;
  v_snooze_count INT := 0;
  v_new_case_ids UUID[] := ARRAY[]::UUID[];
  v_case_id UUID;
BEGIN
  FOR v_decision IN SELECT * FROM jsonb_array_elements(p_decisions)
  LOOP
    v_id := (v_decision->>'prospective_id')::UUID;
    v_action := v_decision->>'action';

    IF v_action = 'consent' THEN
      v_case_id := consent_prospective_to_case(
        v_id,
        (v_decision->>'fee')::NUMERIC,
        v_decision->>'notes'
      );
      v_new_case_ids := array_append(v_new_case_ids, v_case_id);
      v_consent_count := v_consent_count + 1;
    ELSIF v_action = 'decline' THEN
      PERFORM decline_prospective(v_id, v_decision->>'reason');
      v_decline_count := v_decline_count + 1;
    ELSIF v_action = 'snooze' THEN
      PERFORM snooze_prospective(v_id, COALESCE((v_decision->>'days')::INT, 7));
      v_snooze_count := v_snooze_count + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'consented', v_consent_count,
    'declined', v_decline_count,
    'snoozed', v_snooze_count,
    'new_case_ids', to_jsonb(v_new_case_ids)
  );
END;
$$;


ALTER FUNCTION "public"."bulk_process_prospectives"("p_decisions" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."case_applicants_set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END $$;


ALTER FUNCTION "public"."case_applicants_set_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."default_org_id"() RETURNS "uuid"
    LANGUAGE "sql" STABLE
    AS $$ select id from public.orgs where code = 'study2pr' limit 1 $$;


ALTER FUNCTION "public"."default_org_id"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."jobs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" DEFAULT "public"."default_org_id"() NOT NULL,
    "type" "text" NOT NULL,
    "payload" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "status" "text" DEFAULT 'queued'::"text" NOT NULL,
    "attempts" integer DEFAULT 0 NOT NULL,
    "last_error" "text",
    "run_after" timestamp with time zone DEFAULT "now"() NOT NULL,
    "locked_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "jobs_status_check" CHECK (("status" = ANY (ARRAY['queued'::"text", 'running'::"text", 'done'::"text", 'failed'::"text"])))
);


ALTER TABLE "public"."jobs" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."claim_jobs"("p_types" "text"[], "p_limit" integer DEFAULT 10) RETURNS SETOF "public"."jobs"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  return query
  with picked as (
    select id from jobs
    where status = 'queued' and run_after <= now()
      and (p_types is null or type = any(p_types))
    order by created_at
    limit p_limit
    for update skip locked
  )
  update jobs j
     set status = 'running', locked_at = now(), attempts = j.attempts + 1
    from picked where j.id = picked.id
  returning j.*;
end $$;


ALTER FUNCTION "public"."claim_jobs"("p_types" "text"[], "p_limit" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."comm_can_use"() RETURNS boolean
    LANGUAGE "sql" STABLE
    AS $$ select coalesce(public.comm_my_role() = any (array[
     'owner','admin','manager','case_manager','rcic',
     'intake_officer','reception','sales',
     'filing_officer'
   ]), false) $$;


ALTER FUNCTION "public"."comm_can_use"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."comm_is_manager"() RETURNS boolean
    LANGUAGE "sql" STABLE
    AS $$ select coalesce(public.comm_my_role() = any (array[
     'owner','admin','manager','case_manager','rcic'
   ]), false) $$;


ALTER FUNCTION "public"."comm_is_manager"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."comm_is_reception"() RETURNS boolean
    LANGUAGE "sql" STABLE
    AS $$ select coalesce(public.comm_my_role() = any (array[
     'intake_officer','reception','sales'
   ]), false) $$;


ALTER FUNCTION "public"."comm_is_reception"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."comm_me"() RETURNS "uuid"
    LANGUAGE "sql" STABLE
    AS $$ select auth.uid() $$;


ALTER FUNCTION "public"."comm_me"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."comm_my_role"() RETURNS "text"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$ select role from staff_profiles
   where id = auth.uid() and is_active
   limit 1 $$;


ALTER FUNCTION "public"."comm_my_role"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."consent_prospective_to_case"("p_prospective_id" "uuid", "p_fee_quoted" numeric DEFAULT NULL::numeric, "p_notes" "text" DEFAULT NULL::"text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_prosp RECORD;
  v_new_case_id UUID;
  v_org_id UUID;
BEGIN
  SELECT * INTO v_prosp FROM prospective_applications WHERE id = p_prospective_id;
  IF v_prosp.id IS NULL THEN
    RAISE EXCEPTION 'Prospective application % not found', p_prospective_id;
  END IF;
  IF v_prosp.status = 'converted_to_case' THEN
    RAISE EXCEPTION 'Prospective application % already converted', p_prospective_id;
  END IF;

  v_org_id := v_prosp.organization_id;

  INSERT INTO cases (
    organization_id,
    family_unit_id,
    lead_id,
    client_id,
    application_type,
    stage,
    fee,
    assigned_to,
    source_prospective_application_id,
    for_family_role,
    created_at
  ) VALUES (
    v_org_id,
    v_prosp.family_unit_id,
    CASE WHEN v_prosp.for_person_type = 'lead' THEN v_prosp.for_person_id ELSE NULL END,
    CASE WHEN v_prosp.for_person_type = 'client' THEN v_prosp.for_person_id ELSE NULL END,
    v_prosp.target_application_type,
    'new',
    COALESCE(p_fee_quoted, v_prosp.estimated_fee_cad),
    v_prosp.assigned_counselor_id,
    v_prosp.id,
    'self',
    NOW()
  )
  RETURNING id INTO v_new_case_id;

  UPDATE prospective_applications SET
    status = 'converted_to_case',
    promoted_case_id = v_new_case_id,
    client_decision = 'consent',
    client_decision_at = NOW(),
    counselor_notes = COALESCE(p_notes, counselor_notes),
    updated_at = NOW()
  WHERE id = p_prospective_id;

  -- Close any related tasks
  UPDATE tasks SET
    status = 'completed',
    completed_at = NOW()
  WHERE prospective_application_id = p_prospective_id
    AND status != 'completed';

  RETURN v_new_case_id;
END;
$$;


ALTER FUNCTION "public"."consent_prospective_to_case"("p_prospective_id" "uuid", "p_fee_quoted" numeric, "p_notes" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."decline_prospective"("p_prospective_id" "uuid", "p_reason" "text" DEFAULT NULL::"text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  UPDATE prospective_applications SET
    status = 'declined_by_client',
    client_decision = 'decline',
    client_decision_at = NOW(),
    counselor_notes = COALESCE(p_reason, counselor_notes),
    updated_at = NOW()
  WHERE id = p_prospective_id;

  UPDATE tasks SET status = 'completed', completed_at = NOW()
  WHERE prospective_application_id = p_prospective_id AND status != 'completed';
END;
$$;


ALTER FUNCTION "public"."decline_prospective"("p_prospective_id" "uuid", "p_reason" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."document_checklist_rules_set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;


ALTER FUNCTION "public"."document_checklist_rules_set_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."enqueue_job"("p_type" "text", "p_payload" "jsonb") RETURNS "uuid"
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  insert into jobs (type, payload) values (p_type, coalesce(p_payload,'{}'::jsonb))
  returning id
$$;


ALTER FUNCTION "public"."enqueue_job"("p_type" "text", "p_payload" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."ensure_family_unit"("p_lead_id" "uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_existing UUID;
  v_lead RECORD;
  v_new_id UUID;
BEGIN
  SELECT family_unit_id INTO v_existing FROM leads WHERE id = p_lead_id;
  IF v_existing IS NOT NULL THEN
    RETURN v_existing;
  END IF;

  SELECT id, organization_id, salutation, first_name, last_name, country
  INTO v_lead
  FROM leads WHERE id = p_lead_id;

  INSERT INTO family_units (organization_id, unit_name, origin_country, destination_country)
  VALUES (
    v_lead.organization_id,
    TRIM(COALESCE(v_lead.first_name, '') || ' ' || COALESCE(v_lead.last_name, '')) || ' Family Unit',
    v_lead.country,
    'CA'
  )
  RETURNING id INTO v_new_id;

  UPDATE leads SET family_unit_id = v_new_id, family_role = 'primary' WHERE id = p_lead_id;
  UPDATE family_units SET primary_person_id = p_lead_id WHERE id = v_new_id;

  RETURN v_new_id;
END;
$$;


ALTER FUNCTION "public"."ensure_family_unit"("p_lead_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."ensure_family_unit"("p_lead_id" "uuid", "p_unit_name" "text" DEFAULT NULL::"text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_unit_id UUID;
  v_lead_name TEXT;
BEGIN
  -- Check if lead already has a family unit
  SELECT family_unit_id INTO v_unit_id FROM leads WHERE id = p_lead_id;
  IF v_unit_id IS NOT NULL THEN RETURN v_unit_id; END IF;

  -- Create new unit
  SELECT full_name INTO v_lead_name FROM leads WHERE id = p_lead_id;
  INSERT INTO family_units (unit_name)
  VALUES (COALESCE(p_unit_name, v_lead_name || ' Family'))
  RETURNING id INTO v_unit_id;

  -- Link lead to unit
  UPDATE leads SET family_unit_id = v_unit_id, family_role = 'primary'
  WHERE id = p_lead_id;

  RETURN v_unit_id;
END;
$$;


ALTER FUNCTION "public"."ensure_family_unit"("p_lead_id" "uuid", "p_unit_name" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."finish_job"("p_id" "uuid", "p_ok" boolean, "p_error" "text" DEFAULT NULL::"text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if p_ok then
    update jobs set status='done', last_error=null, locked_at=null where id = p_id;
  else
    update jobs set
      status    = case when attempts >= 5 then 'failed' else 'queued' end,  -- dead-letter at 5
      run_after = now() + (interval '30 seconds' * power(2, least(attempts,5))), -- backoff
      last_error = left(p_error, 2000), locked_at = null
    where id = p_id;
  end if;
end $$;


ALTER FUNCTION "public"."finish_job"("p_id" "uuid", "p_ok" boolean, "p_error" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_add_staff"("p_email" "text", "p_full_name" "text", "p_role" "text", "p_phone" "text" DEFAULT NULL::"text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_uid uuid;
begin
  -- Only owner/admin may add staff
  if not fn_is_owner_admin() then
    raise exception 'Only the owner or an admin can add staff members';
  end if;

  select id into v_uid
  from auth.users
  where lower(email) = lower(trim(p_email))
  limit 1;

  if v_uid is null then
    raise exception 'No login found for %. First create the user in Supabase → Authentication → Users → "Add user", then save here again.', p_email;
  end if;

  insert into staff_profiles (id, full_name, email, role, phone, is_active)
  values (v_uid, trim(p_full_name), lower(trim(p_email)), p_role, nullif(trim(coalesce(p_phone,'')),''), true)
  on conflict (id) do update
    set full_name  = excluded.full_name,
        role       = excluded.role,
        phone      = coalesce(excluded.phone, staff_profiles.phone),
        is_active  = true,
        updated_at = now();

  return v_uid;
end $$;


ALTER FUNCTION "public"."fn_add_staff"("p_email" "text", "p_full_name" "text", "p_role" "text", "p_phone" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_assessment_facts"("p" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" IMMUTABLE
    AS $$
declare
  f jsonb := '{}'::jsonb;
  dob date; v numeric; t text;
  l numeric; r numeric; w numeric; s numeric; ov numeric;
begin
  dob := nullif(p#>>'{personal,dob}','')::date;
  if dob is not null then
    f := f || jsonb_build_object('age', extract(year from age(dob))::int);
  end if;
  f := f || jsonb_build_object('marital_status', coalesce(p#>>'{personal,marital_status}','single'));

  -- education
  v := nullif(p#>>'{education,grade12_pct}','')::numeric;
  f := f || jsonb_build_object('grade12_pct', coalesce(v,0));
  f := f || jsonb_build_object('grade10_age', coalesce(nullif(p#>>'{education,grade10_age}','')::numeric, 16));
  f := f || jsonb_build_object('grade12_age', coalesce(nullif(p#>>'{education,grade12_age}','')::numeric, 18));
  f := f || jsonb_build_object('education_gap',
        (coalesce(nullif(p#>>'{education,grade10_age}','')::numeric,16) > 16
         or coalesce(nullif(p#>>'{education,grade12_age}','')::numeric,18) > 18));
  f := f || jsonb_build_object('has_bachelor', jsonb_array_length(coalesce(p#>'{education,bachelors}','[]'::jsonb)) > 0);
  f := f || jsonb_build_object('has_postgrad', jsonb_array_length(coalesce(p#>'{education,postgrads}','[]'::jsonb)) > 0);
  f := f || jsonb_build_object('reappears', coalesce((p#>>'{education,reappears}')::boolean,false));

  -- language (locked thresholds: IELTS all bands >=6 min / >=6.5+overall competitive;
  --           PTE all >=54 min / overall >=60 competitive)
  t  := lower(coalesce(p#>>'{language,test}','none'));
  l  := coalesce(nullif(p#>>'{language,listening}','')::numeric, 0);
  r  := coalesce(nullif(p#>>'{language,reading}','')::numeric, 0);
  w  := coalesce(nullif(p#>>'{language,writing}','')::numeric, 0);
  s  := coalesce(nullif(p#>>'{language,speaking}','')::numeric, 0);
  ov := coalesce(nullif(p#>>'{language,overall}','')::numeric, least(l,r,w,s));
  f := f || jsonb_build_object('language_test', t,
        'lang_min_score', least(l,r,w,s), 'lang_overall', ov,
        'language_min_ok',
          case when t = 'ielts' then least(l,r,w,s) >= 6
               when t = 'pte'   then least(l,r,w,s) >= 54
               when t = 'none'  then false
               else least(l,r,w,s) > 0 end,
        'language_competitive',
          case when t = 'ielts' then least(l,r,w,s) >= 6.5 and ov >= 6.5
               when t = 'pte'   then ov >= 60
               else false end);

  -- work
  f := f || jsonb_build_object('has_work_experience',
        jsonb_array_length(coalesce(p#>'{work}','[]'::jsonb)) > 0,
        'job_count', jsonb_array_length(coalesce(p#>'{work}','[]'::jsonb)));

  -- travel / refusals (hard-gate inputs)
  f := f || jsonb_build_object(
        'has_refusals', jsonb_array_length(coalesce(p#>'{travel,refusals}','[]'::jsonb)) > 0,
        'has_canada_refusal', exists (
          select 1 from jsonb_array_elements(coalesce(p#>'{travel,refusals}','[]'::jsonb)) e
          where lower(e->>'country') in ('canada','ca')),
        'in_canada', coalesce((p#>>'{travel,in_canada}')::boolean,false),
        'canada_status', coalesce(p#>>'{travel,canada_status}',''),
        'has_travel_history', jsonb_array_length(coalesce(p#>'{travel,visits}','[]'::jsonb)) > 0);

  -- family & funds
  f := f || jsonb_build_object(
        'has_spouse', (p#>'{family,spouse}') is not null and (p#>>'{family,spouse}') <> 'null',
        'children_count', jsonb_array_length(coalesce(p#>'{family,children}','[]'::jsonb)),
        'funds_cad', coalesce(nullif(p#>>'{funds,amount_cad}','')::numeric, 0),
        'funds_source', coalesce(p#>>'{funds,source}',''));
  return f;
end $$;


ALTER FUNCTION "public"."fn_assessment_facts"("p" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_assessment_on_submit"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  perform public.fn_assessment_score(new.id);
  insert into public.tasks (lead_id, title, description, status_code, priority,
                            assigned_to, created_by, due_at, sla_rule_code, source)
  values (new.lead_id, 'Review assessment — new questionnaire submitted',
          'Auto-scored against program rules. Open the assessment to review and send proposal (SLA: proposal within 24h of assessment).',
          'open','normal', public.fn_engine_owner(), public.fn_engine_owner(),
          now() + interval '24 hours', 'PROPOSAL_PREP_24H', 'engine');
  return new;
end $$;


ALTER FUNCTION "public"."fn_assessment_on_submit"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_assessment_score"("p_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  a record; facts jsonb; results jsonb := '[]'::jsonb;
  vc record; r record;
  total int; earned int; gates_failed text[]; passed boolean; score numeric;
begin
  select * into a from public.assessments where id = p_id;
  if not found then return null; end if;
  facts := public.fn_assessment_facts(a.payload);

  for vc in (select distinct visa_code from public.program_eligibility_rules where is_active)
  loop
    total := 0; earned := 0; gates_failed := '{}';
    for r in (select * from public.program_eligibility_rules
              where visa_code = vc.visa_code and is_active order by sort_order)
    loop
      passed := public.fn_eval_condition(facts, r.condition);
      if r.rule_type = 'hard_gate' then
        if not passed then gates_failed := gates_failed || r.rule_code; end if;
      else
        total := total + r.weight;
        if passed then earned := earned + r.weight; end if;
      end if;
    end loop;

    score := case when array_length(gates_failed,1) is not null then 0
                  when total = 0 then 100
                  else round(100.0 * earned / total) end;
    results := results || jsonb_build_object(
      'visa_code', vc.visa_code, 'score', score,
      'hard_gate_failures', to_jsonb(gates_failed),
      'qualified', (array_length(gates_failed,1) is null and score >= 60));
  end loop;

  update public.assessments
  set facts = facts, score_results = results, status = 'scored', scored_at = now()
  where id = p_id;
  return results;
end $$;


ALTER FUNCTION "public"."fn_assessment_score"("p_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_audit_ensure_partitions"("p_months_ahead" integer DEFAULT 6) RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_start date;
  v_end   date;
  v_name  text;
  v_made  int := 0;
begin
  for i in 0..greatest(p_months_ahead, 0) loop
    v_start := (date_trunc('month', current_date) + (i || ' months')::interval)::date;
    v_end   := (v_start + interval '1 month')::date;
    v_name  := 'audit_log_' || to_char(v_start, 'YYYY_MM');

    if not exists (
      select 1 from pg_class
      where relname = v_name and relnamespace = 'public'::regnamespace
    ) then
      execute format(
        'create table public.%I partition of public.audit_log for values from (%L) to (%L)',
        v_name, v_start, v_end);
      execute format('revoke all on public.%I from anon, authenticated', v_name);
      v_made := v_made + 1;
    end if;
  end loop;
  return v_made;
end
$$;


ALTER FUNCTION "public"."fn_audit_ensure_partitions"("p_months_ahead" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_build_assessment_sections"("p_template_code" "text") RETURNS "jsonb"
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public'
    AS $$
  select coalesce(jsonb_agg(sec order by sec_order), '[]'::jsonb)
  from (
    select s.sort_order as sec_order,
           jsonb_build_object(
             'title', s.label,
             'questions', coalesce((
               select jsonb_agg(jsonb_build_object(
                        'key',      q.field_code,
                        'label',    q.label,
                        'type',     q.field_type,
                        'required', q.is_required,
                        'options',  q.options,
                        'show_if',  q.visibility_rule,
                        'help',     q.help_text
                      ) order by q.sort_order)
               from questionnaire_questions q where q.section_id = s.id), '[]'::jsonb)
           ) as sec
    from questionnaire_sections s
    join questionnaire_templates t on t.id = s.template_id
    where t.code = p_template_code and t.is_current
  ) x
$$;


ALTER FUNCTION "public"."fn_build_assessment_sections"("p_template_code" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_can_case"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select fn_current_role() in
    ('owner','admin','case_manager','filing_officer','filing_parttime')
$$;


ALTER FUNCTION "public"."fn_can_case"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_can_delete_leads"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$ select coalesce((
     select role = any (array['owner','admin','manager','case_manager','rcic'])
       from staff_profiles where id = auth.uid() and is_active limit 1
   ), false) $$;


ALTER FUNCTION "public"."fn_can_delete_leads"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_current_role"() RETURNS "text"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select role from staff_profiles
  where id = auth.uid() and coalesce(is_active, true)
  limit 1
$$;


ALTER FUNCTION "public"."fn_current_role"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_delete_lead"("p_lead_id" "uuid", "p_reason" "text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_lead        public.leads;
  v_actor       uuid := auth.uid();
  v_actor_name  text;
  v_client_cnt  int;
  v_dep         jsonb;
  v_archive_id  uuid;
begin
  if not public.fn_can_delete_leads() then
    raise exception 'Not permitted: only owner, admin, manager or case_manager may delete leads.'
      using errcode = '42501';
  end if;

  if p_reason is null or btrim(p_reason) = '' then
    raise exception 'A reason is required to delete a lead.' using errcode = '22023';
  end if;

  select * into v_lead from public.leads where id = p_lead_id;
  if not found then
    raise exception 'Lead % not found.', p_lead_id using errcode = 'P0002';
  end if;

  -- Converted leads are never deletable: clients.source_lead_id would be orphaned.
  select count(*) into v_client_cnt
    from public.clients where source_lead_id = p_lead_id;
  if v_client_cnt > 0 then
    raise exception
      'Lead % has been converted to % client record(s) and cannot be deleted. Archive the client instead.',
      p_lead_id, v_client_cnt using errcode = '23503';
  end if;

  select full_name into v_actor_name from public.staff_profiles where id = v_actor;

  -- Snapshot what is about to be destroyed, so the report is meaningful.
  v_dep := jsonb_build_object(
    'tasks',                  (select count(*) from public.tasks                  where lead_id = p_lead_id),
    'entity_notes',           (select count(*) from public.entity_notes           where lead_id = p_lead_id),
    'activity_timeline',      (select count(*) from public.activity_timeline      where lead_id = p_lead_id),
    'messages',               (select count(*) from public.messages               where lead_id = p_lead_id),
    'call_logs',              (select count(*) from public.call_logs              where lead_id = p_lead_id),
    'questionnaire_responses',(select count(*) from public.questionnaire_responses where lead_id = p_lead_id),
    'lead_nurture_targets',   (select count(*) from public.lead_nurture_targets   where lead_id = p_lead_id),
    'contact_identities',     (select count(*) from public.contact_identities     where lead_id = p_lead_id),
    'conversations_orphaned', (select count(*) from public.conversations          where lead_id = p_lead_id),
    'assessments_orphaned',   (select count(*) from public.assessments            where lead_id = p_lead_id),
    'appointments_orphaned',  (select count(*) from public.appointments           where related_lead_id = p_lead_id)
  );

  insert into public.lead_deletions (
    lead_id, lead_snapshot, full_name, phone, email, lead_status,
    assigned_to, dependents, reason, deleted_by, deleted_by_name)
  values (
    p_lead_id, to_jsonb(v_lead), v_lead.full_name, v_lead.phone, v_lead.email,
    v_lead.status, v_lead.assigned_to, v_dep, btrim(p_reason), v_actor, v_actor_name)
  returning id into v_archive_id;

  -- Tell the guard trigger this delete is sanctioned (transaction-local).
  perform set_config('app.lead_delete_ok', v_archive_id::text, true);
  delete from public.leads where id = p_lead_id;
  perform set_config('app.lead_delete_ok', '', true);

  return v_archive_id;
end $$;


ALTER FUNCTION "public"."fn_delete_lead"("p_lead_id" "uuid", "p_reason" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_engine_chain_fire"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $_$
declare
  v_code text; v_label text; v_class text; v_unit uuid; v_fee numeric; r record;
begin
  if new.current_stage_code <> 'approved'
     or new.current_stage_code is not distinct from old.current_stage_code then
    return new;
  end if;

  select vt.code, vt.label into v_code, v_label
  from public.visa_types vt where vt.id = new.visa_type_id;
  v_class := public.fn_program_class(coalesce(v_code,''), coalesce(v_label,''));

  -- find the client's family unit (schema-tolerant), else create one
  begin
    execute 'select family_unit_id from public.family_members where client_id = $1 limit 1'
      into v_unit using new.client_id;
  exception when others then v_unit := null;
  end;
  if v_unit is null then
    begin
      execute 'select family_unit_id from public.family_members where principal_client_id = $1 limit 1'
        into v_unit using new.client_id;
    exception when others then v_unit := null;
    end;
  end if;
  if v_unit is null then
    insert into public.family_units (unit_name, origin_country)
    select c.full_name || ' family', c.country_of_citizenship
    from public.clients c where c.id = new.client_id
    returning id into v_unit;
  end if;

  for r in
    select * from public.chain_rules
    where is_active and trigger_application_type in (v_code, v_class)
  loop
    if exists (select 1 from public.prospective_applications pa
               where pa.source_case_id = new.id and pa.triggered_by_rule = r.id) then
      continue;
    end if;
    select base_fee_cad into v_fee
    from public.visa_types where code = r.target_application_type limit 1;

    insert into public.prospective_applications
      (family_unit_id, for_person_id, for_person_type, triggered_by_rule,
       source_case_id, target_application_type, trigger_date, expires_on,
       status, estimated_fee_cad, assigned_counselor_id, notes)
    values
      (v_unit, new.client_id, 'client', r.id, new.id, r.target_application_type,
       current_date + coalesce(r.delay_days, 0),
       current_date + coalesce(r.delay_days, 0) + 180,
       'pending_counselor_action', v_fee,   -- FIX: was 'proposed' (constraint-invalid)
       coalesce(new.case_manager_id, public.fn_engine_owner()),
       r.counselor_script);
  end loop;
  return new;
end $_$;


ALTER FUNCTION "public"."fn_engine_chain_fire"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_engine_doc_expiry_sync"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare j jsonb; v_case uuid; v_client uuid; v_label text;
begin
  j := to_jsonb(new);
  if (j->>'expires_on') is null then
    -- expiry cleared → deactivate any linked reminder
    update public.expiry_items set is_active = false where source_document_id = new.id;
    return new;
  end if;
  v_case := nullif(j->>'case_id','')::uuid;
  select client_id into v_client from public.cases where id = v_case;
  v_label := coalesce(j->>'file_name', j->>'name', j->>'label', j->>'title',
                      j->>'document_type', 'Uploaded document');
  insert into public.expiry_items
    (client_id, case_id, item_type, label, expires_on, source_document_id, created_by)
  values
    (v_client, v_case, 'document', v_label, (j->>'expires_on')::date, new.id,
     public.fn_engine_owner())
  on conflict (source_document_id) where source_document_id is not null
  do update set expires_on = excluded.expires_on, label = excluded.label, is_active = true;
  return new;
end $$;


ALTER FUNCTION "public"."fn_engine_doc_expiry_sync"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_engine_expiry_sweep"() RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare v record; v_ev uuid; v_task uuid; v_n int := 0; v_alert int;
begin
  for v in
    select i.id as item_id, i.client_id, i.case_id, i.expires_on,
           coalesce(i.label, r.label) as item_label,
           r.item_type, r.alert1_days, r.alert2_days, r.task_title, r.client_template, r.urgent
    from public.expiry_items i
    join public.expiry_alert_rules r on r.item_type = i.item_type and r.is_active
    where i.is_active and i.expires_on > current_date
  loop
    -- which alert stage are we in? (2 = closer to expiry, takes precedence)
    if current_date >= v.expires_on - v.alert2_days then v_alert := 2;
    elsif current_date >= v.expires_on - v.alert1_days then v_alert := 1;
    else continue;
    end if;

    begin
      insert into public.trigger_events (id, trigger_code, client_id, case_id, fired_at, outcome)
      values (gen_random_uuid(), 'EXPIRY' || v_alert || ':' || v.item_id, v.client_id, v.case_id, now(), 'fired')
      returning id into v_ev;
    exception when unique_violation then continue; -- this alert stage already fired
    end;

    insert into public.tasks (case_id, title, description, status_code, priority,
                              assigned_to, created_by, due_date, sla_rule_code, source, trigger_event_id)
    values (v.case_id,
            v.task_title || ' — ' || v.item_label || ' (expires ' || to_char(v.expires_on,'DD Mon YYYY') || ')',
            'Expiry alert ' || v_alert || ' of 2 (blueprint §15). Auto-created by engine.',
            'open','normal', public.fn_engine_owner(), public.fn_engine_owner(),
            least(current_date + 3, v.expires_on), null, 'expiry', v_ev)
    returning id into v_task;
    update public.trigger_events set created_task_id = v_task, outcome = 'task_created' where id = v_ev;

    if v.client_template is not null then
      perform public.fn_engine_queue_message(
        v.client_template, v.client_id, null, v.case_id,
        jsonb_build_object(
          'expiry_date',   to_char(v.expires_on,'DD Mon YYYY'),
          'deadline_date', to_char(v.expires_on,'DD Mon YYYY'),
          'permit_type',   v.item_label,
          'test_name',     v.item_label),
        now(), v.urgent, v_ev);
    end if;
    v_n := v_n + 1;
  end loop;
  return v_n;
end $$;


ALTER FUNCTION "public"."fn_engine_expiry_sweep"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_engine_festival_sweep"() RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare v_f record; v_n int := 0;
begin
  for v_f in
    select * from public.communication_festivals
    where is_active and next_date = (now() at time zone 'Asia/Kolkata')::date
  loop
    insert into public.outbound_messages
      (id, channel, template_code, to_contact, subject, body, variables,
       related_client_id, scheduled_for, status, attempts, created_at, created_by)
    select gen_random_uuid(), m.channel, m.template_name, nullif(c.phone,''), m.subject, m.body,
           jsonb_build_object('first_name', split_part(c.full_name,' ',1)),
           c.id, now(), 'queued', 0, now(), public.fn_engine_owner()
    from public.clients c
    cross join (select channel, template_name, subject, body from public.messages
                where is_template and template_name = v_f.template_name and status='active' limit 1) m
    where not exists (  -- one greeting per client per festival per year
      select 1 from public.outbound_messages om
      where om.template_code = v_f.template_name and om.related_client_id = c.id
        and om.created_at::date = (now() at time zone 'Asia/Kolkata')::date);
    get diagnostics v_n = row_count;
  end loop;
  return v_n;
end $$;


ALTER FUNCTION "public"."fn_engine_festival_sweep"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_engine_on_case_created"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare v_sub uuid; v_n int;
begin
  v_sub := coalesce(new.visa_sub_type_id,
    (select id from public.visa_sub_types
      where visa_type_id = new.visa_type_id and is_active
      order by code limit 1));

  if v_sub is not null then
    insert into public.tasks (case_id, title, description, status_code, priority,
                              assigned_to, created_by, due_date, sla_rule_code, source)
    select new.id, st.title, coalesce(st.description,'') || ' [workflow step ' || st.step_code || ']',
           'open', 'normal',
           public.fn_engine_staff_for_role(coalesce(st.assigned_role,'owner')),
           public.fn_engine_owner(),
           current_date + coalesce(st.due_offset_days, 0),
           st.sla_rule_code, 'workflow'
    from public.step_templates st
    where st.visa_sub_type_id = v_sub and st.is_active
    order by st.sort_order;
    get diagnostics v_n = row_count;
  end if;

  -- §16.2 row 1: onboarding call Day 1 + welcome message
  insert into public.tasks (case_id, title, description, status_code, priority,
                            assigned_to, created_by, due_at, source)
  values (new.id, 'Onboarding call — new application',
          'Welcome/onboarding call with the client (blueprint §16.2). Auto-created by engine.',
          'open', 'normal', coalesce(new.case_manager_id, public.fn_engine_owner()),
          public.fn_engine_owner(), now() + interval '1 day', 'engine');

  perform public.fn_engine_queue_message('CLIENT_WELCOME', new.client_id, null, new.id);
  return new;
end $$;


ALTER FUNCTION "public"."fn_engine_on_case_created"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_engine_on_lead_created"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare v_assignee uuid;
begin
  v_assignee := coalesce(new.assigned_to, public.fn_engine_owner());

  insert into public.tasks (lead_id, title, description, status_code, priority,
                            assigned_to, created_by, due_at, sla_rule_code, source)
  values (new.id, 'First call — new lead',
          'Call the new lead within 2 hours (blueprint §16.1 row 1). Auto-created by engine.',
          'open', 'normal', v_assignee, public.fn_engine_owner(),
          now() + interval '2 hours', 'NEW_LEAD_FIRST_CALL', 'engine');

  perform public.fn_engine_queue_message('LEAD_ACK_D0', null, new.id, null, '{}'::jsonb, now());
  perform public.fn_engine_queue_message('LEAD_FU_D1',  null, new.id, null, '{}'::jsonb, now() + interval '1 day');
  perform public.fn_engine_queue_message('LEAD_FU_D3',  null, new.id, null, '{}'::jsonb, now() + interval '3 days');
  perform public.fn_engine_queue_message('LEAD_FU_D10', null, new.id, null, '{}'::jsonb, now() + interval '10 days');
  perform public.fn_engine_queue_message('LEAD_FU_D14', null, new.id, null, '{}'::jsonb, now() + interval '14 days');
  return new;
end $$;


ALTER FUNCTION "public"."fn_engine_on_lead_created"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_engine_on_stage_change"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare v_class text; v_trig record; v_ev uuid; v_task uuid; v_tpl text;
begin
  if new.current_stage_code is not distinct from old.current_stage_code then return new; end if;

  insert into public.activity_timeline (case_id, client_id, event_type, title, body, is_system, metadata)
  values (new.id, new.client_id, 'stage_change',
          'Stage: ' || coalesce(old.current_stage_code,'—') || ' → ' || new.current_stage_code,
          null, true,
          jsonb_build_object('from', old.current_stage_code, 'to', new.current_stage_code));

  if new.current_stage_code = 'submission' then
    perform public.fn_engine_queue_message('APP_SUBMITTED', new.client_id, null, new.id,
      jsonb_build_object('file_number', coalesce(new.case_code,'')), now(), true);
    insert into public.tasks (case_id, title, description, status_code, priority, assigned_to,
                              created_by, due_date, sla_rule_code, source)
    values (new.id, 'Biometrics check — day 28 post-submission',
            'Verify biometrics instruction letter received and appointment booked (§16.2). Auto-created by engine.',
            'open','normal', coalesce(new.case_manager_id, public.fn_engine_owner()),
            public.fn_engine_owner(), current_date + 28, 'BIOMETRICS_CHECK_D28', 'engine');
  end if;

  if new.current_stage_code = 'approved' then
    perform public.fn_engine_queue_message('APP_APPROVED', new.client_id, null, new.id,
      '{}'::jsonb, now(), true);

    select public.fn_program_class(vt.code, vt.label) into v_class
    from public.visa_types vt where vt.id = new.visa_type_id;

    for v_trig in
      select * from public.upsell_triggers
      where is_active
        and trigger_condition->>'event' = 'case_approved'
        and trigger_condition->>'program_class' = v_class
    loop
      begin
        insert into public.trigger_events (id, trigger_code, client_id, case_id, fired_at, outcome)
        values (gen_random_uuid(), v_trig.code, new.client_id, new.id, now(), 'fired')
        returning id into v_ev;
      exception when unique_violation then
        continue; -- already fired for this case
      end;

      insert into public.tasks (case_id, title, description, status_code, priority, assigned_to,
                                created_by, due_date, sla_rule_code, source, trigger_event_id)
      values (new.id, 'Upsell: ' || v_trig.label,
              coalesce(v_trig.description,'') ||
              case when v_trig.offer_visa_code is not null then ' Offer: ' || v_trig.offer_visa_code else '' end,
              'open','normal', coalesce(new.case_manager_id, public.fn_engine_owner()),
              public.fn_engine_owner(),
              current_date + coalesce(v_trig.delay_days,0) + 7,
              'POST_APPROVAL_UPSELL_7D', 'upsell', v_ev)
      returning id into v_task;
      update public.trigger_events set created_task_id = v_task, outcome = 'task_created' where id = v_ev;

      v_tpl := case v_trig.code
        when 'PR_APPROVED_SUPER_VISA'       then 'UPSELL_SUPER_VISA'
        when 'STUDY_APPROVED_COE'           then 'UPSELL_PREDEPARTURE'
        when 'WP_APPROVED_TRV_SOWP'         then 'UPSELL_WP_OPTIONS'
        when 'PGWP_APPROVED_EE'             then 'UPSELL_PR_PLANNING'
        when 'CITIZENSHIP_APPROVED_PASSPORT'then 'CITIZENSHIP_PASSPORT'
        else null end;
      if v_tpl is not null then
        perform public.fn_engine_queue_message(v_tpl, new.client_id, null, new.id,
          '{}'::jsonb, now() + make_interval(days => greatest(coalesce(v_trig.delay_days,0), 1)), false, v_ev);
      end if;
    end loop;
  end if;

  if new.current_stage_code = 'refused' then
    begin
      insert into public.trigger_events (id, trigger_code, client_id, case_id, fired_at, outcome)
      values (gen_random_uuid(), 'REFUSED_GCMS_REAPPLY', new.client_id, new.id, now(), 'fired')
      returning id into v_ev;
      insert into public.tasks (case_id, title, description, status_code, priority, assigned_to,
                                created_by, due_at, sla_rule_code, source, trigger_event_id)
      values
        (new.id, '[URGENT] Refusal — senior call within 1 hour',
         'Call client about the refusal within 1 hour (§16.2). Then order GCMS/ATIP notes (offer VAS_GCMS).',
         'open','normal', public.fn_engine_owner(), public.fn_engine_owner(),
         now() + interval '1 hour', 'ADR_RESPONSE_2HR', 'engine', v_ev);
      insert into public.tasks (case_id, title, description, status_code, priority, assigned_to,
                                created_by, due_date, source, trigger_event_id)
      values
        (new.id, 'Reapplication strategy — GCMS notes should have arrived',
         'Review GCMS notes and propose reapplication (same type, stronger file) or alternate pathway (§14).',
         'open','normal', public.fn_engine_owner(), public.fn_engine_owner(),
         current_date + 30, 'engine', v_ev);
    exception when unique_violation then null;
    end;
  end if;

  return new;
end $$;


ALTER FUNCTION "public"."fn_engine_on_stage_change"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_engine_outbox_sweep"() RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare v_n int := 0; v_m record;
begin
  -- cancel queued messages for leads that converted or were lost
  update public.outbound_messages om set status = 'cancelled',
    error_message = 'auto-cancelled: lead no longer in nurture'
  where om.status = 'queued' and om.related_lead_id is not null
    and exists (select 1 from public.leads l where l.id = om.related_lead_id
                and (coalesce(l.status,'') in ('converted','lost')
                  or coalesce(l.lifecycle_state,'') in ('converted','lost')));

  -- enforce 1 msg/client/day: postpone non-urgent messages beyond the cap
  for v_m in
    select om.id, om.related_client_id, om.related_lead_id, om.scheduled_for
    from public.outbound_messages om
    where om.status = 'queued' and om.scheduled_for <= now()
      and coalesce((om.variables->>'_urgent')::boolean, false) = false
    order by om.scheduled_for
  loop
    if exists (
      select 1 from public.outbound_messages x
      where x.id <> v_m.id
        and x.status in ('queued','sent')
        and coalesce(x.related_client_id, '00000000-0000-0000-0000-000000000000'::uuid)
            is not distinct from coalesce(v_m.related_client_id, '00000000-0000-0000-0000-000000000000'::uuid)
        and coalesce(x.related_lead_id, '00000000-0000-0000-0000-000000000000'::uuid)
            is not distinct from coalesce(v_m.related_lead_id, '00000000-0000-0000-0000-000000000000'::uuid)
        and (x.sent_at::date = current_date
             or (x.status = 'queued' and x.scheduled_for::date = current_date and x.scheduled_for < v_m.scheduled_for))
    ) then
      update public.outbound_messages set scheduled_for = scheduled_for + interval '1 day'
      where id = v_m.id;
      v_n := v_n + 1;
    end if;
  end loop;
  return v_n;
end $$;


ALTER FUNCTION "public"."fn_engine_outbox_sweep"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_engine_owner"() RETURNS "uuid"
    LANGUAGE "sql" STABLE
    AS $$
  select id from public.staff_profiles where role = 'owner' and is_active limit 1;
$$;


ALTER FUNCTION "public"."fn_engine_owner"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_engine_queue_message"("p_template" "text", "p_client" "uuid", "p_lead" "uuid", "p_case" "uuid", "p_vars" "jsonb" DEFAULT '{}'::"jsonb", "p_when" timestamp with time zone DEFAULT "now"(), "p_urgent" boolean DEFAULT false, "p_trigger_event" "uuid" DEFAULT NULL::"uuid") RETURNS "uuid"
    LANGUAGE "plpgsql"
    AS $$
declare v_t record; v_to text; v_id uuid;
begin
  select channel, subject, body into v_t
  from public.messages where is_template and template_name = p_template and status = 'active' limit 1;
  if not found then return null; end if;

  select coalesce(
    (select nullif(phone,'')  from public.clients where id = p_client),
    (select nullif(phone,'')  from public.leads   where id = p_lead)
  ) into v_to;

  insert into public.outbound_messages
    (id, channel, template_code, to_contact, subject, body, variables,
     related_case_id, related_lead_id, related_client_id, trigger_event_id,
     scheduled_for, status, attempts, created_at, created_by)
  values
    (gen_random_uuid(), v_t.channel, p_template, v_to, v_t.subject, v_t.body,
     p_vars || jsonb_build_object('_urgent', p_urgent),
     p_case, p_lead, p_client, p_trigger_event,
     p_when, 'queued', 0, now(), public.fn_engine_owner())
  returning id into v_id;
  return v_id;
end $$;


ALTER FUNCTION "public"."fn_engine_queue_message"("p_template" "text", "p_client" "uuid", "p_lead" "uuid", "p_case" "uuid", "p_vars" "jsonb", "p_when" timestamp with time zone, "p_urgent" boolean, "p_trigger_event" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_engine_sla_sweep"() RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare v_t record; v_n int := 0;
begin
  for v_t in
    select t.id, t.title, t.case_id, t.lead_id, r.escalate_to_role, r.label as sla_label
    from public.tasks t
    join public.sla_rules r on r.code = t.sla_rule_code and r.is_active
    where t.status_code in ('open','in_progress')
      and coalesce(t.due_at, t.due_date::timestamptz) < now()
  loop
    begin
      insert into public.trigger_events (id, trigger_code, case_id, fired_at, outcome)
      values (gen_random_uuid(), 'SLA_ESC:' || v_t.id, v_t.case_id, now(), 'escalated');
    exception when unique_violation then continue;
    end;
    insert into public.tasks (case_id, lead_id, title, description, status_code, priority,
                              assigned_to, created_by, due_at, source)
    values (v_t.case_id, v_t.lead_id,
            '[SLA OVERDUE] ' || v_t.title,
            'SLA "' || coalesce(v_t.sla_label,'') || '" missed. Original task still open — action or reassign (blueprint §11.2).',
            'open','normal',
            public.fn_engine_staff_for_role(coalesce(v_t.escalate_to_role,'owner')),
            public.fn_engine_owner(), now() + interval '4 hours', 'sla');
    v_n := v_n + 1;
  end loop;
  return v_n;
end $$;


ALTER FUNCTION "public"."fn_engine_sla_sweep"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_engine_staff_for_role"("p_role" "text") RETURNS "uuid"
    LANGUAGE "sql" STABLE
    AS $$
  select coalesce(
    (select id from public.staff_profiles where role = p_role and is_active limit 1),
    (select id from public.staff_profiles where role = 'owner' and is_active limit 1)
  );
$$;


ALTER FUNCTION "public"."fn_engine_staff_for_role"("p_role" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_entity_notes_guard"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if tg_op = 'UPDATE' then
    if old.is_locked and not new.is_locked then
      if not public.fn_is_owner_admin() then
        raise exception 'Only owner/admin can unlock a locked note';
      end if;
      new.unlocked_at := now();
      new.unlocked_by := auth.uid();
    end if;
    if new.is_locked and not old.is_locked then
      new.locked_at := now();
      new.locked_by := coalesce(auth.uid(), new.locked_by);
    end if;
    new.updated_at := now();
  elsif tg_op = 'INSERT' and new.is_locked then
    new.locked_at := coalesce(new.locked_at, now());
    new.locked_by := coalesce(new.locked_by, auth.uid());
  end if;
  return new;
end $$;


ALTER FUNCTION "public"."fn_entity_notes_guard"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_entity_notes_timeline"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_type  text;
  v_title text;
  v_label text := replace(new.note_type, '_', ' ');
begin
  if tg_op = 'INSERT' then
    v_type  := 'note_added';
    v_title := (case when new.is_locked then 'Locked note added (' else 'Note added (' end) || v_label || ')';
  elsif tg_op = 'UPDATE' and old.is_locked and not new.is_locked then
    v_type  := 'note_unlocked';
    v_title := 'Note unlocked (' || v_label || ')';
  else
    return new;
  end if;

  -- body is intentionally NULL: timeline logs the EVENT only, never the note text.
  insert into public.activity_timeline
    (lead_id, case_id, client_id, event_type, title, body, actor_id, is_system, occurred_at)
  values
    (new.lead_id, new.case_id, new.client_id, v_type, v_title, null,
     coalesce(auth.uid(), new.created_by), false, now());
  return new;
end $$;


ALTER FUNCTION "public"."fn_entity_notes_timeline"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_eval_condition"("facts" "jsonb", "cond" "jsonb") RETURNS boolean
    LANGUAGE "plpgsql" IMMUTABLE
    AS $$
declare fv jsonb; op text; cv jsonb;
begin
  fv := facts -> (cond->>'fact');
  op := cond->>'op';
  cv := cond -> 'value';
  if fv is null then return false; end if;
  return case op
    when '>='  then (fv::text)::numeric >= (cv::text)::numeric
    when '<='  then (fv::text)::numeric <= (cv::text)::numeric
    when '>'   then (fv::text)::numeric >  (cv::text)::numeric
    when '<'   then (fv::text)::numeric <  (cv::text)::numeric
    when '='   then fv = cv
    when '!='  then fv <> cv
    when 'is_true'  then fv = 'true'::jsonb
    when 'is_false' then fv = 'false'::jsonb
    when 'in'  then cv @> fv
    else false end;
exception when others then return false;
end $$;


ALTER FUNCTION "public"."fn_eval_condition"("facts" "jsonb", "cond" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_finance_entry_timeline"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  insert into public.activity_timeline
    (case_id, client_id, event_type, title, body, actor_id, is_system, occurred_at)
  values
    (new.case_id, new.client_id, 'finance_entry',
     initcap(replace(new.entry_type, '_', ' ')) || ' — ₹' || to_char(new.amount_inr, 'FM99,99,99,999'),
     nullif(concat_ws(' · ', new.category, new.paid_to, new.description), ''),
     coalesce(auth.uid(), new.recorded_by), false, now());
  return new;
end $$;


ALTER FUNCTION "public"."fn_finance_entry_timeline"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_is_accounts"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select fn_current_role() in ('accounts','accountant')
$$;


ALTER FUNCTION "public"."fn_is_accounts"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_is_case_mgr"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select fn_current_role() = 'case_manager'
$$;


ALTER FUNCTION "public"."fn_is_case_mgr"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_is_filing_ft"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select fn_current_role() = 'filing_officer'
$$;


ALTER FUNCTION "public"."fn_is_filing_ft"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_is_filing_pt"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select fn_current_role() = 'filing_parttime'
$$;


ALTER FUNCTION "public"."fn_is_filing_pt"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_is_finance"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists (
    select 1 from public.staff_profiles sp
    where sp.id = auth.uid() and sp.is_active = true
      and sp.role in ('owner','admin','accountant')
  );
$$;


ALTER FUNCTION "public"."fn_is_finance"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_is_intake"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select fn_current_role() = 'intake_officer'
$$;


ALTER FUNCTION "public"."fn_is_intake"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_is_owner_admin"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select fn_current_role() in ('owner','admin')
$$;


ALTER FUNCTION "public"."fn_is_owner_admin"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_is_staff"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select fn_current_role() is not null
$$;


ALTER FUNCTION "public"."fn_is_staff"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_leads_guard_delete"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if coalesce(current_setting('app.lead_delete_ok', true), '') = '' then
    raise exception
      'Direct lead deletion is disabled. Use select public.fn_delete_lead(<lead_id>, <reason>) so it is recorded.'
      using errcode = '42501';
  end if;
  return old;
end $$;


ALTER FUNCTION "public"."fn_leads_guard_delete"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_messaging_is_live"() RETURNS boolean
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public'
    AS $$
  select coalesce(
    (select value #>> '{}' = 'live' from app_settings where key = 'messaging_mode'),
    false)
$$;


ALTER FUNCTION "public"."fn_messaging_is_live"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."fn_messaging_is_live"() IS 'Global outbound kill-switch. app_settings.messaging_mode must equal ''live'' before any
   external message is sent. Phase 0 safety guard — check this in EVERY sender path.';



CREATE OR REPLACE FUNCTION "public"."fn_outbox_guard"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
begin
  if new.status = 'sent' and old.status is distinct from 'sent'
     and not public.fn_messaging_is_live() then
    raise exception 'Outbound blocked: messaging_mode is dry_run (Phase 0 guard). '
                    'Set app_settings.messaging_mode = ''live'' to enable sending.';
  end if;
  if new.status = 'sent' and new.scheduled_for > now() then
    raise exception 'Outbound blocked: scheduled_for (%) is in the future.', new.scheduled_for;
  end if;
  return new;
end $$;


ALTER FUNCTION "public"."fn_outbox_guard"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_program_class"("p_code" "text", "p_label" "text") RETURNS "text"
    LANGUAGE "sql" IMMUTABLE
    AS $_$
  select case
    when p_code = 'CA_PGWP' or p_label ilike '%pgwp%'                             then 'pgwp'
    when p_code ilike '%CITIZEN%'                                                 then 'citizenship'
    when p_code in ('SV','NON_SDS','AU_500','US_F1','UK_STUDY','NZ_STUDY','EU_STUDY','AU_STUDY')
      or p_label ~* '\y(study|student)\y'                                         then 'study'
    when p_code ~ '^(LMIA|WP_|CA_LMIA|CA_SOWP|SOWP|UNIV_WORK|US_H1B|AU_482|AU_WORK|CA_WP)'
      or p_label ~* '\y(work permit|work visa|lmia|owp|h1b)\y'                    then 'work'
    when p_label ~* '\y(visit|visitor|tourism|super visa|trv|b1/b2)\y'
      or p_code ~ '(VISITOR|TRV|TOURISM|SUPER|VV|B1B2|AU_600)'                    then 'visitor'
    when p_label ~* '\y(pr|permanent|express entry|pnp|nominee|sponsor|green card|atlantic)\y'
      or p_code ~ '^(PR_|EXPRESS|PNP|CA_EE|CA_.*_(APP|EOI)$|US_EB|AU_18|AU_PR|AU_SPOUSE|CA_SPOUSAL|CA_PARENTS|CA_ATLANTIC|CA_PR)' then 'pr'
    else 'other'
  end;
$_$;


ALTER FUNCTION "public"."fn_program_class"("p_code" "text", "p_label" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_tasks_supersede"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
begin
  if new.task_key is null then
    return new;                      -- manual/untyped tasks never supersede
  end if;

  update public.tasks t
     set status_code   = 'dismissed',
         superseded_by = new.id,
         completed_at  = coalesce(t.completed_at, now()),
         closed_note   = 'Superseded by a newer ' || new.task_key || ' task'
   where t.id <> new.id
     and t.task_key = new.task_key
     and t.status_code not in ('done','completed','cancelled','dismissed')
     and ( (new.lead_id is not null and t.lead_id = new.lead_id)
        or (new.case_id is not null and t.case_id = new.case_id) );

  return new;
end $$;


ALTER FUNCTION "public"."fn_tasks_supersede"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."gen_case_code"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
declare vt text;
begin
  if new.case_code is null then
    select upper(left(replace(vt_code,'_',''),2)) into vt
      from (select code as vt_code from visa_types where id = new.visa_type_id) s;
    new.case_code := coalesce(vt,'CS') || '-' || to_char(now(),'YYYY') || '-' || lpad(nextval('case_code_seq')::text,5,'0');
  end if;
  return new;
end;$$;


ALTER FUNCTION "public"."gen_case_code"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."gen_client_code"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  if new.client_code is null then
    new.client_code := 'CL-' || to_char(now(),'YYYY') || '-' || lpad(nextval('client_code_seq')::text,5,'0');
  end if;
  return new;
end;$$;


ALTER FUNCTION "public"."gen_client_code"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_family_members"("p_family_unit_id" "uuid") RETURNS TABLE("id" "uuid", "lead_id" "uuid", "client_id" "uuid", "full_name" "text", "family_role" "text", "primary_application" "text", "expected_revenue_cad" numeric)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT
    l.id, l.id AS lead_id, NULL::UUID AS client_id,
    l.full_name, COALESCE(l.family_role, 'member') AS family_role,
    NULL::TEXT AS primary_application,
    NULL::NUMERIC AS expected_revenue_cad
  FROM leads l WHERE l.family_unit_id = p_family_unit_id
  UNION ALL
  SELECT
    c.id, NULL::UUID AS lead_id, c.id AS client_id,
    c.full_name, COALESCE(c.family_role, 'member') AS family_role,
    NULL::TEXT AS primary_application,
    NULL::NUMERIC AS expected_revenue_cad
  FROM clients c WHERE c.family_unit_id = p_family_unit_id;
$$;


ALTER FUNCTION "public"."get_family_members"("p_family_unit_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."identity_channels"("p_channel" "text") RETURNS "text"[]
    LANGUAGE "sql" IMMUTABLE
    AS $$
  select case when p_channel in ('phone','whatsapp','sms')
              then array['phone','whatsapp','sms'] else array[p_channel] end
$$;


ALTER FUNCTION "public"."identity_channels"("p_channel" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_staff"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select fn_is_staff() $$;


ALTER FUNCTION "public"."is_staff"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."log_stage_change"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
declare
  v_actor uuid := auth.uid();
begin
  if old.current_stage_code is distinct from new.current_stage_code then
    insert into public.case_stage_history
      (case_id, from_stage_code, to_stage_code, changed_by, note)
    values
      (new.id,
       old.current_stage_code,
       new.current_stage_code,
       v_actor,
       case when v_actor is null then 'system' else null end);

    new.stage_entered_at := now();
  end if;
  return new;
end
$$;


ALTER FUNCTION "public"."log_stage_change"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mark_case_outcome"("p_case_id" "uuid", "p_outcome" "text", "p_decision_date" "date", "p_study_end_date" "date" DEFAULT NULL::"date", "p_document_expiry_date" "date" DEFAULT NULL::"date", "p_pgwp_expiry_date" "date" DEFAULT NULL::"date", "p_landing_date" "date" DEFAULT NULL::"date", "p_first_canadian_work_day" "date" DEFAULT NULL::"date") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF p_outcome NOT IN ('approved', 'refused', 'withdrawn', 'extended') THEN
    RAISE EXCEPTION 'Invalid outcome: %', p_outcome;
  END IF;

  -- The on_case_decision trigger fires after this UPDATE and creates
  -- prospective_applications + tasks based on chain_rules.
  UPDATE cases SET
    outcome = p_outcome,
    decision_date = p_decision_date,
    study_end_date = COALESCE(p_study_end_date, study_end_date),
    document_expiry_date = COALESCE(p_document_expiry_date, document_expiry_date),
    pgwp_expiry_date = COALESCE(p_pgwp_expiry_date, pgwp_expiry_date),
    landing_date = COALESCE(p_landing_date, landing_date),
    first_canadian_work_day = COALESCE(p_first_canadian_work_day, first_canadian_work_day),
    checklist_step = CASE WHEN p_outcome = 'approved' THEN 7 ELSE checklist_step END,
    stage = CASE
      WHEN p_outcome = 'approved' THEN 'approved'
      WHEN p_outcome = 'refused' THEN 'refused'
      ELSE stage
    END
  WHERE id = p_case_id;
END;
$$;


ALTER FUNCTION "public"."mark_case_outcome"("p_case_id" "uuid", "p_outcome" "text", "p_decision_date" "date", "p_study_end_date" "date", "p_document_expiry_date" "date", "p_pgwp_expiry_date" "date", "p_landing_date" "date", "p_first_canadian_work_day" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mark_conversation_read"("p_conversation" "uuid") RETURNS "void"
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  update conversations set unread_count = 0, updated_at = now()
  where id = p_conversation
$$;


ALTER FUNCTION "public"."mark_conversation_read"("p_conversation" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mask_email"("e" "text") RETURNS "text"
    LANGUAGE "sql" IMMUTABLE
    AS $$
  select case
    when e is null or position('@' in e) = 0 then e
    else left(e, 1) || repeat('•', 5) || substring(e from position('@' in e))
  end
$$;


ALTER FUNCTION "public"."mask_email"("e" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mask_phone"("p" "text") RETURNS "text"
    LANGUAGE "sql" IMMUTABLE
    AS $$
  select case
    when p is null or length(regexp_replace(p,'\D','','g')) < 4 then p
    else repeat('•', greatest(length(regexp_replace(p,'\D','','g')) - 4, 2))
         || right(regexp_replace(p,'\D','','g'), 4)
  end
$$;


ALTER FUNCTION "public"."mask_phone"("p" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."normalize_email"("p" "text") RETURNS "text"
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO 'public'
    AS $$ select nullif(lower(btrim(p)), '') $$;


ALTER FUNCTION "public"."normalize_email"("p" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."normalize_phone"("p" "text") RETURNS "text"
    LANGUAGE "plpgsql" IMMUTABLE
    SET "search_path" TO 'public'
    AS $$
declare d text;
begin
  if p is null then return null; end if;
  d := regexp_replace(p, '[^0-9+]', '', 'g');       -- keep digits and +
  if d like '00%' then d := '+' || substr(d, 3); end if;
  if d like '+%' then
    d := '+' || regexp_replace(substr(d, 2), '[^0-9]', '', 'g');
    return case when length(d) between 9 and 16 then d else null end;
  end if;
  d := regexp_replace(d, '[^0-9]', '', 'g');        -- pure digits now
  if length(d) = 10 then return '+91' || d; end if;                 -- 98765-43210
  if length(d) = 11 and d like '0%' then return '+91' || substr(d, 2); end if; -- 0987…
  if length(d) = 12 and d like '91%' then return '+' || d; end if;  -- 9198…
  if length(d) between 11 and 15 then return '+' || d; end if;      -- other CC (e.g. 1647…)
  return null;                                                       -- unusable
end $$;


ALTER FUNCTION "public"."normalize_phone"("p" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."populate_case_documents_from_rules"("p_case_id" "uuid") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_visa_code     text;
  v_inserted      integer := 0;
  v_applicant     RECORD;
  v_rule          RECORD;
BEGIN
  -- Resolve the visa_type_code for the case
  SELECT vt.code INTO v_visa_code
  FROM cases c
  JOIN visa_types vt ON vt.id = c.visa_type_id
  WHERE c.id = p_case_id;

  IF v_visa_code IS NULL THEN
    RAISE NOTICE 'Case % has no visa_type — skipping checklist auto-populate', p_case_id;
    RETURN 0;
  END IF;

  -- For each applicant on the case, insert a case_documents row per matching rule
  FOR v_applicant IN
    SELECT id, applicant_role FROM case_applicants WHERE case_id = p_case_id
  LOOP
    FOR v_rule IN
      SELECT * FROM document_checklist_rules
      WHERE visa_type_code = v_visa_code
        AND is_active = true
        AND (applicant_role = v_applicant.applicant_role OR applicant_role = 'all')
    LOOP
      INSERT INTO case_documents (
        case_id, title, document_type, status, is_deleted, storage_bucket, storage_path
      )
      SELECT
        p_case_id,
        v_rule.display_label,
        v_rule.category,
        'pending_upload',
        false,
        'case-files',
        p_case_id || '/_pending_/' || v_rule.document_code
      WHERE NOT EXISTS (
        SELECT 1 FROM case_documents cd
        WHERE cd.case_id = p_case_id
          AND cd.title = v_rule.display_label
          AND cd.is_deleted = false
      );
      IF FOUND THEN v_inserted := v_inserted + 1; END IF;
    END LOOP;
  END LOOP;

  RETURN v_inserted;
END $$;


ALTER FUNCTION "public"."populate_case_documents_from_rules"("p_case_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."questionnaire_responses_set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;


ALTER FUNCTION "public"."questionnaire_responses_set_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."questionnaire_templates_set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;


ALTER FUNCTION "public"."questionnaire_templates_set_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."refresh_dashboard_views"() RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
begin
  refresh materialized view mv_dashboard_kpis;
  refresh materialized view mv_cases_at_risk;
end;$$;


ALTER FUNCTION "public"."refresh_dashboard_views"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."resolve_identity"("p_channel" "text", "p_handle" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE
    SET "search_path" TO 'public'
    AS $$
declare
  v_norm text;
  v_rows jsonb;
  v_n int;
  v_owners int;
begin
  v_norm := case when p_channel = 'email' then normalize_email(p_handle)
                 else normalize_phone(p_handle) end;
  if v_norm is null then
    return jsonb_build_object('status','none','handle_norm',null,'candidates','[]'::jsonb);
  end if;

  select jsonb_agg(jsonb_build_object(
           'identity_id', id, 'client_id', client_id, 'lead_id', lead_id,
           'link_status', link_status, 'channel', channel)),
         count(*),
         count(distinct coalesce(client_id::text, 'L' || lead_id::text))
           filter (where client_id is not null or lead_id is not null)
    into v_rows, v_n, v_owners
  from contact_identities
  where org_id = default_org_id()
    and channel = any (identity_channels(p_channel))
    and handle_norm = v_norm;

  if v_n = 0 or v_rows is null then
    return jsonb_build_object('status','none','handle_norm',v_norm,'candidates','[]'::jsonb);
  end if;

  -- conflict-flagged rows, or more than one distinct owner → ambiguous
  if v_owners > 1
     or exists (select 1 from contact_identities
                where org_id = default_org_id()
                  and channel = any (identity_channels(p_channel))
                  and handle_norm = v_norm and link_status = 'conflict') then
    return jsonb_build_object('status','ambiguous','handle_norm',v_norm,'candidates',v_rows);
  end if;

  if v_owners = 0 then  -- identities exist but unlinked
    return jsonb_build_object('status','none','handle_norm',v_norm,'candidates',v_rows);
  end if;

  return jsonb_build_object(
    'status','match','handle_norm',v_norm,
    'identity_id', (v_rows->0->>'identity_id')::uuid,
    'client_id',  (select (c->>'client_id')::uuid from jsonb_array_elements(v_rows) c where c->>'client_id' is not null limit 1),
    'lead_id',    (select (c->>'lead_id')::uuid  from jsonb_array_elements(v_rows) c where c->>'lead_id'  is not null limit 1),
    'candidates', v_rows);
end $$;


ALTER FUNCTION "public"."resolve_identity"("p_channel" "text", "p_handle" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."snooze_prospective"("p_prospective_id" "uuid", "p_snooze_days" integer DEFAULT 7) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF p_snooze_days NOT BETWEEN 1 AND 30 THEN
    RAISE EXCEPTION 'snooze days must be 1-30';
  END IF;

  UPDATE prospective_applications SET
    trigger_date = trigger_date + p_snooze_days,
    expires_on = COALESCE(expires_on, trigger_date) + p_snooze_days,
    updated_at = NOW()
  WHERE id = p_prospective_id;

  UPDATE tasks SET
    sla_due_at = COALESCE(sla_due_at, NOW()) + (p_snooze_days || ' days')::interval,
    due_at = COALESCE(due_at, NOW()) + (p_snooze_days || ' days')::interval
  WHERE prospective_application_id = p_prospective_id AND status != 'completed';
END;
$$;


ALTER FUNCTION "public"."snooze_prospective"("p_prospective_id" "uuid", "p_snooze_days" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."staff_profiles_block_self_escalation"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  -- If the row's user is updating themselves and is NOT owner/admin,
  -- forbid changes to privileged columns.
  IF auth.uid() = OLD.id AND NOT public.auth_is_owner_or_admin() THEN
    IF NEW.role IS DISTINCT FROM OLD.role THEN
      RAISE EXCEPTION 'You are not allowed to change your own role';
    END IF;
    IF NEW.is_active IS DISTINCT FROM OLD.is_active THEN
      RAISE EXCEPTION 'You are not allowed to change your own active status';
    END IF;
    IF NEW.id IS DISTINCT FROM OLD.id THEN
      RAISE EXCEPTION 'You cannot change the primary key';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."staff_profiles_block_self_escalation"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."task_acknowledge"("p_task" "uuid") RETURNS "void"
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  update tasks
     set acknowledged_at = now(),
         acknowledged_by = auth.uid(),
         status_code = case when status_code = 'open' then 'in_progress' else status_code end,
         updated_at = now()
   where id = p_task
$$;


ALTER FUNCTION "public"."task_acknowledge"("p_task" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."task_complete"("p_task" "uuid", "p_notes" "text" DEFAULT NULL::"text") RETURNS "void"
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  update tasks
     set status_code = 'done',
         completed_at = now(),
         closed_note  = coalesce(p_notes, closed_note),
         updated_at = now()
   where id = p_task
$$;


ALTER FUNCTION "public"."task_complete"("p_task" "uuid", "p_notes" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."task_dismiss"("p_task" "uuid", "p_reason" "text" DEFAULT NULL::"text") RETURNS "void"
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  update tasks
     set status_code = 'dismissed',
         completed_at = now(),
         closed_note  = coalesce(p_reason, 'Dismissed by staff'),
         updated_at = now()
   where id = p_task
$$;


ALTER FUNCTION "public"."task_dismiss"("p_task" "uuid", "p_reason" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."wa_window_state"("p_conversation" "uuid") RETURNS "jsonb"
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public'
    AS $$
  select jsonb_build_object(
    'open',       coalesce(last_inbound_at > now() - interval '24 hours', false),
    'expires_at', last_inbound_at + interval '24 hours',
    'seconds_left', greatest(0, extract(epoch from (last_inbound_at + interval '24 hours' - now()))::int)
  ) from conversations where id = p_conversation
$$;


ALTER FUNCTION "public"."wa_window_state"("p_conversation" "uuid") OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."_backup_clients_20260712" (
    "id" "uuid",
    "client_code" "text",
    "full_name" "text",
    "email" "text",
    "phone" "text",
    "whatsapp" "text",
    "date_of_birth" "date",
    "country_of_citizenship" "text",
    "current_residence" "text",
    "preferred_language" "text",
    "portal_user_id" "uuid",
    "source_lead_id" "uuid",
    "onboarded_at" timestamp with time zone,
    "birthday_month_day" "text",
    "notes" "text",
    "is_active" boolean,
    "created_at" timestamp with time zone,
    "updated_at" timestamp with time zone,
    "family_unit_id" "uuid",
    "family_role" "text"
);


ALTER TABLE "public"."_backup_clients_20260712" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."_backup_clients_20260715" (
    "id" "uuid",
    "client_code" "text",
    "full_name" "text",
    "email" "text",
    "phone" "text",
    "whatsapp" "text",
    "date_of_birth" "date",
    "country_of_citizenship" "text",
    "current_residence" "text",
    "preferred_language" "text",
    "portal_user_id" "uuid",
    "source_lead_id" "uuid",
    "onboarded_at" timestamp with time zone,
    "birthday_month_day" "text",
    "notes" "text",
    "is_active" boolean,
    "created_at" timestamp with time zone,
    "updated_at" timestamp with time zone,
    "family_unit_id" "uuid",
    "family_role" "text"
);


ALTER TABLE "public"."_backup_clients_20260715" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."_backup_clients_dupes_20260712" (
    "id" "uuid",
    "client_code" "text",
    "full_name" "text",
    "email" "text",
    "phone" "text",
    "whatsapp" "text",
    "date_of_birth" "date",
    "country_of_citizenship" "text",
    "current_residence" "text",
    "preferred_language" "text",
    "portal_user_id" "uuid",
    "source_lead_id" "uuid",
    "onboarded_at" timestamp with time zone,
    "birthday_month_day" "text",
    "notes" "text",
    "is_active" boolean,
    "created_at" timestamp with time zone,
    "updated_at" timestamp with time zone,
    "family_unit_id" "uuid",
    "family_role" "text"
);


ALTER TABLE "public"."_backup_clients_dupes_20260712" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."_backup_clients_dupes_20260715" (
    "id" "uuid",
    "client_code" "text",
    "full_name" "text",
    "email" "text",
    "phone" "text",
    "whatsapp" "text",
    "date_of_birth" "date",
    "country_of_citizenship" "text",
    "current_residence" "text",
    "preferred_language" "text",
    "portal_user_id" "uuid",
    "source_lead_id" "uuid",
    "onboarded_at" timestamp with time zone,
    "birthday_month_day" "text",
    "notes" "text",
    "is_active" boolean,
    "created_at" timestamp with time zone,
    "updated_at" timestamp with time zone,
    "family_unit_id" "uuid",
    "family_role" "text"
);


ALTER TABLE "public"."_backup_clients_dupes_20260715" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."_backup_leads_20260712" (
    "id" "uuid",
    "full_name" "text",
    "email" "text",
    "phone" "text",
    "country_of_residence" "text",
    "source_code" "text",
    "source_detail" "text",
    "status" "text",
    "assessment_submitted_at" timestamp with time zone,
    "assessment_data" "jsonb",
    "crs_score" integer,
    "interested_visa_type_id" "uuid",
    "assigned_to" "uuid",
    "first_response_due_at" timestamp with time zone,
    "first_responded_at" timestamp with time zone,
    "converted_at" timestamp with time zone,
    "converted_client_id" "uuid",
    "lost_reason" "text",
    "notes" "text",
    "created_at" timestamp with time zone,
    "updated_at" timestamp with time zone,
    "lifecycle_state" "text",
    "assessment_score" integer,
    "assessment_completed_at" timestamp with time zone,
    "country_of_interest" "text",
    "has_ircc_invitation" boolean,
    "created_by" "uuid",
    "assessment_threshold_met" boolean,
    "ircc_invitation_type" "text",
    "nationality" "text",
    "referrer_name" "text",
    "waiting_reason" "text",
    "waiting_start_date" "date",
    "waiting_end_date" "date",
    "waiting_contact_frequency" "text",
    "waiting_review_notes" "text",
    "waiting_linked_milestone" "text",
    "stage_metadata" "jsonb",
    "referral_partner_id" "uuid",
    "family_unit_id" "uuid",
    "family_role" "text",
    "first_name" "text",
    "last_name" "text",
    "source_person_name" "text",
    "interested_visa_sub_type_id" "uuid",
    "agent_partner_id" "uuid"
);


ALTER TABLE "public"."_backup_leads_20260712" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."_backup_leads_20260715" (
    "id" "uuid",
    "full_name" "text",
    "email" "text",
    "phone" "text",
    "country_of_residence" "text",
    "source_code" "text",
    "source_detail" "text",
    "status" "text",
    "assessment_submitted_at" timestamp with time zone,
    "assessment_data" "jsonb",
    "crs_score" integer,
    "interested_visa_type_id" "uuid",
    "assigned_to" "uuid",
    "first_response_due_at" timestamp with time zone,
    "first_responded_at" timestamp with time zone,
    "converted_at" timestamp with time zone,
    "converted_client_id" "uuid",
    "lost_reason" "text",
    "notes" "text",
    "created_at" timestamp with time zone,
    "updated_at" timestamp with time zone,
    "lifecycle_state" "text",
    "assessment_score" integer,
    "assessment_completed_at" timestamp with time zone,
    "country_of_interest" "text",
    "has_ircc_invitation" boolean,
    "created_by" "uuid",
    "assessment_threshold_met" boolean,
    "ircc_invitation_type" "text",
    "nationality" "text",
    "referrer_name" "text",
    "waiting_reason" "text",
    "waiting_start_date" "date",
    "waiting_end_date" "date",
    "waiting_contact_frequency" "text",
    "waiting_review_notes" "text",
    "waiting_linked_milestone" "text",
    "stage_metadata" "jsonb",
    "referral_partner_id" "uuid",
    "family_unit_id" "uuid",
    "family_role" "text",
    "first_name" "text",
    "last_name" "text",
    "source_person_name" "text",
    "interested_visa_sub_type_id" "uuid",
    "agent_partner_id" "uuid",
    "enquiry_client_id" "uuid",
    "interested_category_id" "uuid",
    "interested_country" "text"
);


ALTER TABLE "public"."_backup_leads_20260715" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."_backup_visa_types_20260717" (
    "id" "uuid",
    "code" "text",
    "label" "text",
    "category" "text",
    "base_fee_inr" numeric(10,0),
    "base_fee_cad" numeric(10,2),
    "govt_fee_cad" numeric(10,2),
    "is_active" boolean,
    "notes" "text",
    "requires_canada_residency" boolean,
    "is_commission_based" boolean,
    "destination_country" "text",
    "category_id" "uuid"
);


ALTER TABLE "public"."_backup_visa_types_20260717" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."_bak_assessment_forms_20260729" (
    "id" "uuid",
    "code" "text",
    "title" "text",
    "description" "text",
    "is_active" boolean,
    "is_default" boolean,
    "sections" "jsonb",
    "created_at" timestamp with time zone,
    "updated_at" timestamp with time zone
);


ALTER TABLE "public"."_bak_assessment_forms_20260729" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."activity_timeline" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "lead_id" "uuid",
    "case_id" "uuid",
    "client_id" "uuid",
    "event_type" "text" NOT NULL,
    "title" "text" NOT NULL,
    "body" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "actor_id" "uuid",
    "is_system" boolean DEFAULT false NOT NULL,
    "occurred_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."activity_timeline" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."activity_log" AS
 SELECT "id",
    "lead_id",
    "case_id",
    "client_id",
    "event_type",
    "title",
    "body",
    "body" AS "description",
    "metadata",
    "actor_id",
    "is_system",
    "occurred_at",
    "created_at"
   FROM "public"."activity_timeline";


ALTER VIEW "public"."activity_log" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."agent_partners" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "company" "text",
    "email" "text",
    "phone" "text",
    "city" "text",
    "country" "text",
    "commission_pct" numeric(5,2) DEFAULT 0,
    "is_active" boolean DEFAULT true NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."agent_partners" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."api_keys" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "label" "text" NOT NULL,
    "key_prefix" "text" NOT NULL,
    "key_hash" "text" NOT NULL,
    "owner_staff_id" "uuid",
    "scopes" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "last_used_at" timestamp with time zone,
    "expires_at" timestamp with time zone,
    "revoked_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid"
);


ALTER TABLE "public"."api_keys" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."app_settings" (
    "key" "text" NOT NULL,
    "value" "jsonb" NOT NULL,
    "description" "text",
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_by" "uuid"
);


ALTER TABLE "public"."app_settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."applicant_relationships" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "from_applicant_id" "uuid" NOT NULL,
    "to_applicant_id" "uuid" NOT NULL,
    "relationship_type" "text" NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "applicant_relationships_distinct" CHECK (("from_applicant_id" <> "to_applicant_id")),
    CONSTRAINT "applicant_relationships_type_check" CHECK (("relationship_type" = ANY (ARRAY['spouse'::"text", 'common_law'::"text", 'parent_of'::"text", 'child_of'::"text", 'sibling'::"text", 'sponsor_of'::"text"])))
);


ALTER TABLE "public"."applicant_relationships" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."cases" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "case_code" "text",
    "client_id" "uuid" NOT NULL,
    "visa_type_id" "uuid" NOT NULL,
    "visa_sub_type_id" "uuid",
    "current_stage_code" "text" DEFAULT 'intake'::"text",
    "stage_entered_at" timestamp with time zone DEFAULT "now"(),
    "case_manager_id" "uuid",
    "senior_advisor_id" "uuid",
    "quoted_fee_inr" numeric(10,0) DEFAULT 0,
    "quoted_govt_fee_cad" numeric(10,2) DEFAULT 0,
    "total_invoiced_inr" numeric(10,0) DEFAULT 0,
    "total_paid_inr" numeric(10,0) DEFAULT 0,
    "target_submission_date" "date",
    "submitted_at" timestamp with time zone,
    "decision_at" timestamp with time zone,
    "outcome" "text",
    "priority" "text" DEFAULT 'normal'::"text",
    "risk_level" "text" DEFAULT 'green'::"text",
    "notes" "text",
    "is_archived" boolean DEFAULT false,
    "archived_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "uci_number" "text",
    "application_number" "text",
    "payment_plan_enabled" boolean DEFAULT false NOT NULL,
    "payment_stages" "jsonb",
    CONSTRAINT "cases_outcome_check" CHECK ((("outcome" = ANY (ARRAY['approved'::"text", 'refused'::"text", 'withdrawn'::"text", 'pending'::"text"])) OR ("outcome" IS NULL))),
    CONSTRAINT "cases_priority_check" CHECK (("priority" = ANY (ARRAY['low'::"text", 'normal'::"text", 'high'::"text", 'urgent'::"text"]))),
    CONSTRAINT "cases_risk_level_check" CHECK (("risk_level" = ANY (ARRAY['green'::"text", 'yellow'::"text", 'red'::"text"])))
);


ALTER TABLE "public"."cases" OWNER TO "postgres";


COMMENT ON COLUMN "public"."cases"."uci_number" IS 'IRCC Universal Client Identifier (e.g. 1234-5678)';



COMMENT ON COLUMN "public"."cases"."application_number" IS 'IRCC application / file number for this case';



COMMENT ON COLUMN "public"."cases"."payment_stages" IS 'Optional payment plan captured at conversion: array of {amount, note, due_date}. Max 3 stages.';



CREATE OR REPLACE VIEW "public"."applications" WITH ("security_invoker"='true') AS
 SELECT "id",
    "case_code",
    "client_id",
    "visa_type_id",
    "visa_sub_type_id",
    "current_stage_code",
    "stage_entered_at",
    "case_manager_id",
    "senior_advisor_id",
    "quoted_fee_inr",
    "quoted_govt_fee_cad",
    "total_invoiced_inr",
    "total_paid_inr",
    "target_submission_date",
    "submitted_at",
    "decision_at",
    "outcome",
    "priority",
    "risk_level",
    "notes",
    "is_archived",
    "archived_at",
    "created_at",
    "updated_at",
    "uci_number",
    "application_number",
    "payment_plan_enabled",
    "payment_stages",
    "id" AS "application_id",
    "case_code" AS "application_code",
    "case_manager_id" AS "owner_id"
   FROM "public"."cases" "c";


ALTER VIEW "public"."applications" OWNER TO "postgres";


COMMENT ON VIEW "public"."applications" IS 'Canonical name for cases. Phase 0 rename step 1: UI reads/writes "applications";
   the physical table stays `cases` until every reference is migrated.';



CREATE TABLE IF NOT EXISTS "public"."appointments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "staff_id" "uuid" NOT NULL,
    "scheduled_at" timestamp with time zone NOT NULL,
    "duration_min" integer DEFAULT 30,
    "type" "text" DEFAULT 'other'::"text" NOT NULL,
    "title" "text" NOT NULL,
    "notes" "text",
    "related_lead_id" "uuid",
    "related_case_id" "uuid",
    "meeting_link" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "appointments_type_check" CHECK (("type" = ANY (ARRAY['discovery_call'::"text", 'phone_call'::"text", 'team_meeting'::"text", 'consultation'::"text", 'follow_up'::"text", 'other'::"text"])))
);


ALTER TABLE "public"."appointments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."assessment_forms" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "code" "text" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "is_active" boolean DEFAULT true NOT NULL,
    "is_default" boolean DEFAULT false NOT NULL,
    "sections" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."assessment_forms" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."assessments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "lead_id" "uuid",
    "client_id" "uuid",
    "status" "text" DEFAULT 'submitted'::"text" NOT NULL,
    "payload" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "facts" "jsonb",
    "score_results" "jsonb",
    "submitted_at" timestamp with time zone DEFAULT "now"(),
    "scored_at" timestamp with time zone,
    "reviewed_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "form_code" "text"
);


ALTER TABLE "public"."assessments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."audit_log" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "occurred_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "actor_id" "uuid",
    "actor_type" "text",
    "entity_type" "text" NOT NULL,
    "entity_id" "uuid" NOT NULL,
    "action" "text" NOT NULL,
    "changes" "jsonb",
    "ip_address" "inet",
    "user_agent" "text",
    CONSTRAINT "audit_log_actor_type_check" CHECK (("actor_type" = ANY (ARRAY['staff'::"text", 'client'::"text", 'system'::"text", 'webhook'::"text"])))
)
PARTITION BY RANGE ("occurred_at");


ALTER TABLE "public"."audit_log" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."audit_log_2026_04" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "occurred_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "actor_id" "uuid",
    "actor_type" "text",
    "entity_type" "text" NOT NULL,
    "entity_id" "uuid" NOT NULL,
    "action" "text" NOT NULL,
    "changes" "jsonb",
    "ip_address" "inet",
    "user_agent" "text",
    CONSTRAINT "audit_log_actor_type_check" CHECK (("actor_type" = ANY (ARRAY['staff'::"text", 'client'::"text", 'system'::"text", 'webhook'::"text"])))
);


ALTER TABLE "public"."audit_log_2026_04" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."audit_log_2026_05" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "occurred_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "actor_id" "uuid",
    "actor_type" "text",
    "entity_type" "text" NOT NULL,
    "entity_id" "uuid" NOT NULL,
    "action" "text" NOT NULL,
    "changes" "jsonb",
    "ip_address" "inet",
    "user_agent" "text",
    CONSTRAINT "audit_log_actor_type_check" CHECK (("actor_type" = ANY (ARRAY['staff'::"text", 'client'::"text", 'system'::"text", 'webhook'::"text"])))
);


ALTER TABLE "public"."audit_log_2026_05" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."audit_log_2026_06" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "occurred_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "actor_id" "uuid",
    "actor_type" "text",
    "entity_type" "text" NOT NULL,
    "entity_id" "uuid" NOT NULL,
    "action" "text" NOT NULL,
    "changes" "jsonb",
    "ip_address" "inet",
    "user_agent" "text",
    CONSTRAINT "audit_log_actor_type_check" CHECK (("actor_type" = ANY (ARRAY['staff'::"text", 'client'::"text", 'system'::"text", 'webhook'::"text"])))
);


ALTER TABLE "public"."audit_log_2026_06" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."audit_log_2026_07" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "occurred_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "actor_id" "uuid",
    "actor_type" "text",
    "entity_type" "text" NOT NULL,
    "entity_id" "uuid" NOT NULL,
    "action" "text" NOT NULL,
    "changes" "jsonb",
    "ip_address" "inet",
    "user_agent" "text",
    CONSTRAINT "audit_log_actor_type_check" CHECK (("actor_type" = ANY (ARRAY['staff'::"text", 'client'::"text", 'system'::"text", 'webhook'::"text"])))
);


ALTER TABLE "public"."audit_log_2026_07" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."audit_log_2026_08" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "occurred_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "actor_id" "uuid",
    "actor_type" "text",
    "entity_type" "text" NOT NULL,
    "entity_id" "uuid" NOT NULL,
    "action" "text" NOT NULL,
    "changes" "jsonb",
    "ip_address" "inet",
    "user_agent" "text",
    CONSTRAINT "audit_log_actor_type_check" CHECK (("actor_type" = ANY (ARRAY['staff'::"text", 'client'::"text", 'system'::"text", 'webhook'::"text"])))
);


ALTER TABLE "public"."audit_log_2026_08" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."audit_log_2026_09" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "occurred_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "actor_id" "uuid",
    "actor_type" "text",
    "entity_type" "text" NOT NULL,
    "entity_id" "uuid" NOT NULL,
    "action" "text" NOT NULL,
    "changes" "jsonb",
    "ip_address" "inet",
    "user_agent" "text",
    CONSTRAINT "audit_log_actor_type_check" CHECK (("actor_type" = ANY (ARRAY['staff'::"text", 'client'::"text", 'system'::"text", 'webhook'::"text"])))
);


ALTER TABLE "public"."audit_log_2026_09" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."audit_log_2026_10" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "occurred_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "actor_id" "uuid",
    "actor_type" "text",
    "entity_type" "text" NOT NULL,
    "entity_id" "uuid" NOT NULL,
    "action" "text" NOT NULL,
    "changes" "jsonb",
    "ip_address" "inet",
    "user_agent" "text",
    CONSTRAINT "audit_log_actor_type_check" CHECK (("actor_type" = ANY (ARRAY['staff'::"text", 'client'::"text", 'system'::"text", 'webhook'::"text"])))
);


ALTER TABLE "public"."audit_log_2026_10" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."audit_log_2026_11" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "occurred_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "actor_id" "uuid",
    "actor_type" "text",
    "entity_type" "text" NOT NULL,
    "entity_id" "uuid" NOT NULL,
    "action" "text" NOT NULL,
    "changes" "jsonb",
    "ip_address" "inet",
    "user_agent" "text",
    CONSTRAINT "audit_log_actor_type_check" CHECK (("actor_type" = ANY (ARRAY['staff'::"text", 'client'::"text", 'system'::"text", 'webhook'::"text"])))
);


ALTER TABLE "public"."audit_log_2026_11" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."audit_log_2026_12" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "occurred_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "actor_id" "uuid",
    "actor_type" "text",
    "entity_type" "text" NOT NULL,
    "entity_id" "uuid" NOT NULL,
    "action" "text" NOT NULL,
    "changes" "jsonb",
    "ip_address" "inet",
    "user_agent" "text",
    CONSTRAINT "audit_log_actor_type_check" CHECK (("actor_type" = ANY (ARRAY['staff'::"text", 'client'::"text", 'system'::"text", 'webhook'::"text"])))
);


ALTER TABLE "public"."audit_log_2026_12" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."audit_log_2027_01" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "occurred_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "actor_id" "uuid",
    "actor_type" "text",
    "entity_type" "text" NOT NULL,
    "entity_id" "uuid" NOT NULL,
    "action" "text" NOT NULL,
    "changes" "jsonb",
    "ip_address" "inet",
    "user_agent" "text",
    CONSTRAINT "audit_log_actor_type_check" CHECK (("actor_type" = ANY (ARRAY['staff'::"text", 'client'::"text", 'system'::"text", 'webhook'::"text"])))
);


ALTER TABLE "public"."audit_log_2027_01" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."audit_log_2027_02" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "occurred_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "actor_id" "uuid",
    "actor_type" "text",
    "entity_type" "text" NOT NULL,
    "entity_id" "uuid" NOT NULL,
    "action" "text" NOT NULL,
    "changes" "jsonb",
    "ip_address" "inet",
    "user_agent" "text",
    CONSTRAINT "audit_log_actor_type_check" CHECK (("actor_type" = ANY (ARRAY['staff'::"text", 'client'::"text", 'system'::"text", 'webhook'::"text"])))
);


ALTER TABLE "public"."audit_log_2027_02" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."audit_log_default" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "occurred_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "actor_id" "uuid",
    "actor_type" "text",
    "entity_type" "text" NOT NULL,
    "entity_id" "uuid" NOT NULL,
    "action" "text" NOT NULL,
    "changes" "jsonb",
    "ip_address" "inet",
    "user_agent" "text",
    CONSTRAINT "audit_log_actor_type_check" CHECK (("actor_type" = ANY (ARRAY['staff'::"text", 'client'::"text", 'system'::"text", 'webhook'::"text"])))
);


ALTER TABLE "public"."audit_log_default" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."call_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "lead_id" "uuid",
    "case_id" "uuid",
    "client_id" "uuid",
    "staff_id" "uuid",
    "direction" "text" DEFAULT 'outbound'::"text" NOT NULL,
    "outcome" "text" DEFAULT 'no_answer'::"text" NOT NULL,
    "duration_seconds" integer,
    "emotional_state" "text",
    "objection" "text",
    "promise_made" "text",
    "next_step" "text",
    "next_contact_at" timestamp with time zone,
    "notes" "text",
    "notes_length" integer GENERATED ALWAYS AS ("length"("notes")) STORED,
    "called_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."call_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."case_applicants" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "case_id" "uuid" NOT NULL,
    "full_name" "text" NOT NULL,
    "email" "text",
    "phone" "text",
    "date_of_birth" "date",
    "gender" "text",
    "nationality" "text",
    "current_residence" "text",
    "current_status_in_canada" "text",
    "passport_number" "text",
    "passport_expiry" "date",
    "applicant_role" "text" DEFAULT 'principal'::"text" NOT NULL,
    "is_primary" boolean DEFAULT false NOT NULL,
    "client_id" "uuid",
    "included_in_application" boolean DEFAULT true NOT NULL,
    "exclusion_reason" "text",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid",
    CONSTRAINT "case_applicants_role_check" CHECK (("applicant_role" = ANY (ARRAY['principal'::"text", 'spouse'::"text", 'common_law'::"text", 'dependent_child'::"text", 'dependent_parent'::"text", 'sponsor'::"text"])))
);


ALTER TABLE "public"."case_applicants" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."case_code_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."case_code_seq" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."case_documents" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "case_id" "uuid" NOT NULL,
    "document_type" "text" NOT NULL,
    "title" "text" NOT NULL,
    "storage_bucket" "text" DEFAULT 'case-documents'::"text" NOT NULL,
    "storage_path" "text" NOT NULL,
    "file_size_bytes" bigint,
    "mime_type" "text",
    "page_count" integer,
    "uploaded_by" "uuid",
    "uploaded_by_client_id" "uuid",
    "status" "text" DEFAULT 'pending_review'::"text",
    "verified_by" "uuid",
    "verified_at" timestamp with time zone,
    "expires_at" "date",
    "version" integer DEFAULT 1,
    "replaces_document_id" "uuid",
    "notes" "text",
    "is_deleted" boolean DEFAULT false,
    "deleted_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "expires_on" "date",
    CONSTRAINT "case_documents_status_check" CHECK (("status" = ANY (ARRAY['pending_review'::"text", 'verified'::"text", 'needs_redo'::"text", 'rejected'::"text", 'expired'::"text"])))
);


ALTER TABLE "public"."case_documents" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."case_notes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "case_id" "uuid" NOT NULL,
    "author_id" "uuid",
    "body" "text" NOT NULL,
    "is_pinned" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "case_notes_body_check" CHECK (("length"(TRIM(BOTH FROM "body")) > 0))
);


ALTER TABLE "public"."case_notes" OWNER TO "postgres";


COMMENT ON TABLE "public"."case_notes" IS 'Internal staff notes on cases — visible to all staff, full audit trail.';



CREATE TABLE IF NOT EXISTS "public"."case_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "case_id" "uuid" NOT NULL,
    "requested_by" "uuid" NOT NULL,
    "request_type" "text" NOT NULL,
    "description" "text" NOT NULL,
    "status" "text" DEFAULT 'open'::"text" NOT NULL,
    "fulfilled_by" "uuid",
    "fulfilled_note" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "fulfilled_at" timestamp with time zone,
    CONSTRAINT "case_requests_request_type_check" CHECK (("request_type" = ANY (ARRAY['missing_document'::"text", 'clearer_scan'::"text", 'client_question'::"text", 'data_needed'::"text", 'other'::"text"]))),
    CONSTRAINT "case_requests_status_check" CHECK (("status" = ANY (ARRAY['open'::"text", 'in_progress'::"text", 'fulfilled'::"text", 'rejected'::"text"])))
);


ALTER TABLE "public"."case_requests" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."case_stage_history" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "case_id" "uuid" NOT NULL,
    "from_stage_code" "text",
    "to_stage_code" "text",
    "changed_by" "uuid",
    "changed_at" timestamp with time zone DEFAULT "now"(),
    "note" "text"
);


ALTER TABLE "public"."case_stage_history" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."case_stages_ref" (
    "code" "text" NOT NULL,
    "label" "text" NOT NULL,
    "sort_order" integer DEFAULT 0,
    "is_terminal" boolean DEFAULT false
);


ALTER TABLE "public"."case_stages_ref" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."chain_rules" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "rule_code" "text" NOT NULL,
    "description" "text",
    "counselor_script" "text",
    "trigger_application_type" "text",
    "target_application_type" "text" NOT NULL,
    "delay_days" integer DEFAULT 0,
    "sla_days" integer DEFAULT 14,
    "priority" "text" DEFAULT 'normal'::"text",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "chain_rules_priority_check" CHECK (("priority" = ANY (ARRAY['critical'::"text", 'high'::"text", 'normal'::"text"])))
);


ALTER TABLE "public"."chain_rules" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."client_code_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."client_code_seq" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."clients" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "client_code" "text",
    "full_name" "text" NOT NULL,
    "email" "text",
    "phone" "text",
    "whatsapp" "text",
    "date_of_birth" "date",
    "country_of_citizenship" "text",
    "current_residence" "text",
    "preferred_language" "text" DEFAULT 'en'::"text",
    "portal_user_id" "uuid",
    "source_lead_id" "uuid",
    "onboarded_at" timestamp with time zone DEFAULT "now"(),
    "birthday_month_day" "text" GENERATED ALWAYS AS ((("lpad"((EXTRACT(month FROM "date_of_birth"))::"text", 2, '0'::"text") || '-'::"text") || "lpad"((EXTRACT(day FROM "date_of_birth"))::"text", 2, '0'::"text"))) STORED,
    "notes" "text",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "family_unit_id" "uuid",
    "family_role" "text"
);


ALTER TABLE "public"."clients" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."comm_attachments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" DEFAULT "public"."default_org_id"() NOT NULL,
    "event_id" "uuid" NOT NULL,
    "storage_path" "text" NOT NULL,
    "mime_type" "text",
    "file_name" "text",
    "size_bytes" bigint,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."comm_attachments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."comm_audit_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" DEFAULT "public"."default_org_id"() NOT NULL,
    "actor_id" "uuid",
    "action" "text" NOT NULL,
    "entity_type" "text" NOT NULL,
    "entity_id" "uuid",
    "detail" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."comm_audit_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."comm_notifications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" DEFAULT "public"."default_org_id"() NOT NULL,
    "staff_id" "uuid" NOT NULL,
    "kind" "text" NOT NULL,
    "title" "text" NOT NULL,
    "body" "text",
    "conversation_id" "uuid",
    "read_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."comm_notifications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."commission_rules" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "code" "text" NOT NULL,
    "label" "text" NOT NULL,
    "rate_percent" numeric(5,2),
    "flat_amount_inr" numeric(10,0),
    "trigger_event" "text" NOT NULL,
    "is_active" boolean DEFAULT true,
    "notes" "text"
);


ALTER TABLE "public"."commission_rules" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."commissions" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "rule_code" "text",
    "staff_id" "uuid",
    "case_id" "uuid",
    "invoice_id" "uuid",
    "amount_inr" numeric(10,0) NOT NULL,
    "earned_at" timestamp with time zone DEFAULT "now"(),
    "status" "text" DEFAULT 'accrued'::"text",
    "paid_at" timestamp with time zone,
    "payout_reference" "text",
    "notes" "text",
    CONSTRAINT "commissions_status_check" CHECK (("status" = ANY (ARRAY['accrued'::"text", 'approved'::"text", 'paid'::"text", 'cancelled'::"text", 'disputed'::"text"])))
);


ALTER TABLE "public"."commissions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."communication_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" DEFAULT "public"."default_org_id"() NOT NULL,
    "conversation_id" "uuid" NOT NULL,
    "direction" "text" NOT NULL,
    "channel" "text" NOT NULL,
    "actor_id" "uuid",
    "event_type" "text" NOT NULL,
    "body" "text",
    "payload" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "provider_message_id" "text",
    "delivery_status" "text",
    "occurred_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "communication_events_channel_check" CHECK (("channel" = ANY (ARRAY['phone'::"text", 'whatsapp'::"text", 'email'::"text", 'sms'::"text", 'webchat'::"text"]))),
    CONSTRAINT "communication_events_delivery_status_check" CHECK (("delivery_status" = ANY (ARRAY['queued'::"text", 'sent'::"text", 'delivered'::"text", 'read'::"text", 'failed'::"text"]))),
    CONSTRAINT "communication_events_direction_check" CHECK (("direction" = ANY (ARRAY['inbound'::"text", 'outbound'::"text", 'internal'::"text"])))
);


ALTER TABLE "public"."communication_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."communication_festivals" (
    "code" "text" NOT NULL,
    "label" "text" NOT NULL,
    "next_date" "date" NOT NULL,
    "template_name" "text" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "notes" "text"
);


ALTER TABLE "public"."communication_festivals" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."contact_identities" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" DEFAULT "public"."default_org_id"() NOT NULL,
    "channel" "text" NOT NULL,
    "handle_raw" "text" NOT NULL,
    "handle_norm" "text" NOT NULL,
    "client_id" "uuid",
    "lead_id" "uuid",
    "link_status" "text" DEFAULT 'linked'::"text" NOT NULL,
    "is_primary" boolean DEFAULT false NOT NULL,
    "verified_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "contact_identities_channel_check" CHECK (("channel" = ANY (ARRAY['phone'::"text", 'whatsapp'::"text", 'email'::"text", 'sms'::"text"]))),
    CONSTRAINT "contact_identities_link_status_check" CHECK (("link_status" = ANY (ARRAY['linked'::"text", 'conflict'::"text", 'unlinked'::"text"])))
);


ALTER TABLE "public"."contact_identities" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."contact_identities_bak_20260726" (
    "id" "uuid",
    "org_id" "uuid",
    "channel" "text",
    "handle_raw" "text",
    "handle_norm" "text",
    "client_id" "uuid",
    "lead_id" "uuid",
    "link_status" "text",
    "is_primary" boolean,
    "verified_at" timestamp with time zone,
    "created_at" timestamp with time zone
);


ALTER TABLE "public"."contact_identities_bak_20260726" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."contact_reveal_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "staff_id" "uuid" NOT NULL,
    "entity_type" "text" NOT NULL,
    "entity_id" "uuid" NOT NULL,
    "field" "text" NOT NULL,
    "revealed_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "contact_reveal_log_entity_type_check" CHECK (("entity_type" = ANY (ARRAY['lead'::"text", 'client'::"text", 'case'::"text"]))),
    CONSTRAINT "contact_reveal_log_field_check" CHECK (("field" = ANY (ARRAY['phone'::"text", 'email'::"text", 'whatsapp'::"text"])))
);


ALTER TABLE "public"."contact_reveal_log" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."conversations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" DEFAULT "public"."default_org_id"() NOT NULL,
    "channel" "text" NOT NULL,
    "client_id" "uuid",
    "lead_id" "uuid",
    "contact_identity_id" "uuid",
    "assigned_to" "uuid",
    "status" "text" DEFAULT 'open'::"text" NOT NULL,
    "last_inbound_at" timestamp with time zone,
    "last_outbound_at" timestamp with time zone,
    "sla_due_at" timestamp with time zone,
    "unread_count" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "conversations_channel_check" CHECK (("channel" = ANY (ARRAY['phone'::"text", 'whatsapp'::"text", 'email'::"text", 'sms'::"text", 'webchat'::"text"]))),
    CONSTRAINT "conversations_status_check" CHECK (("status" = ANY (ARRAY['open'::"text", 'triage'::"text", 'closed'::"text"])))
);


ALTER TABLE "public"."conversations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."countries" (
    "code" "text" NOT NULL,
    "label" "text" NOT NULL,
    "sort_order" integer DEFAULT 100 NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."countries" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."document_checklist_rules" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "visa_type_code" "text" NOT NULL,
    "applicant_role" "text" DEFAULT 'principal'::"text" NOT NULL,
    "document_code" "text" NOT NULL,
    "display_label" "text" NOT NULL,
    "category" "text",
    "is_optional" boolean DEFAULT false NOT NULL,
    "expiry_tracking" boolean DEFAULT false NOT NULL,
    "ircc_form_id" "text",
    "notes" "text",
    "sort_order" integer DEFAULT 0 NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid",
    CONSTRAINT "document_checklist_rules_role_check" CHECK (("applicant_role" = ANY (ARRAY['principal'::"text", 'spouse'::"text", 'common_law'::"text", 'dependent_child'::"text", 'dependent_parent'::"text", 'sponsor'::"text", 'all'::"text"])))
);


ALTER TABLE "public"."document_checklist_rules" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."document_checklists" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "visa_sub_type_id" "uuid" NOT NULL,
    "document_type" "text" NOT NULL,
    "label" "text" NOT NULL,
    "is_required" boolean DEFAULT true,
    "applies_to" "text" DEFAULT 'principal'::"text",
    "sort_order" integer DEFAULT 0,
    "guidance_notes" "text",
    CONSTRAINT "document_checklists_applies_to_check" CHECK (("applies_to" = ANY (ARRAY['principal'::"text", 'spouse'::"text", 'dependent'::"text", 'all'::"text"])))
);


ALTER TABLE "public"."document_checklists" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."entity_notes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "lead_id" "uuid",
    "client_id" "uuid",
    "case_id" "uuid",
    "note_type" "text" DEFAULT 'general'::"text" NOT NULL,
    "body" "text" NOT NULL,
    "is_locked" boolean DEFAULT false NOT NULL,
    "locked_at" timestamp with time zone,
    "locked_by" "uuid",
    "unlocked_at" timestamp with time zone,
    "unlocked_by" "uuid",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "migrated_from" "text",
    CONSTRAINT "chk_entity_notes_target" CHECK ((("lead_id" IS NOT NULL) OR ("client_id" IS NOT NULL) OR ("case_id" IS NOT NULL))),
    CONSTRAINT "entity_notes_note_type_check" CHECK (("note_type" = ANY (ARRAY['general'::"text", 'follow_up'::"text", 'internal'::"text", 'client_communication'::"text", 'call'::"text", 'meeting'::"text", 'email'::"text", 'whatsapp'::"text", 'gc_account'::"text"])))
);


ALTER TABLE "public"."entity_notes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."expiry_alert_rules" (
    "item_type" "text" NOT NULL,
    "label" "text" NOT NULL,
    "alert1_days" integer NOT NULL,
    "alert2_days" integer NOT NULL,
    "task_title" "text" NOT NULL,
    "client_template" "text",
    "urgent" boolean DEFAULT false NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL
);


ALTER TABLE "public"."expiry_alert_rules" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."expiry_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "client_id" "uuid",
    "case_id" "uuid",
    "item_type" "text" NOT NULL,
    "label" "text",
    "expires_on" "date" NOT NULL,
    "notes" "text",
    "is_active" boolean DEFAULT true NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "source_document_id" "uuid"
);


ALTER TABLE "public"."expiry_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."family_members" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "principal_client_id" "uuid" NOT NULL,
    "full_name" "text" NOT NULL,
    "relationship" "text" NOT NULL,
    "date_of_birth" "date",
    "is_dependent" boolean DEFAULT true,
    "is_included_on_current_case" boolean DEFAULT true,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "passport_number" "text",
    CONSTRAINT "family_members_relationship_check" CHECK (("relationship" = ANY (ARRAY['spouse'::"text", 'common_law'::"text", 'child'::"text", 'parent'::"text", 'sibling'::"text", 'guardian'::"text", 'other'::"text"])))
);


ALTER TABLE "public"."family_members" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."family_units" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "unit_name" "text" NOT NULL,
    "origin_country" "text",
    "lifetime_revenue_cad" numeric DEFAULT 0,
    "expected_lifetime_revenue_cad" numeric DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."family_units" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."finance_entries" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "case_id" "uuid",
    "client_id" "uuid",
    "entry_type" "text" NOT NULL,
    "direction" "text" DEFAULT 'out'::"text" NOT NULL,
    "amount_inr" numeric(12,2) NOT NULL,
    "category" "text",
    "paid_to" "text",
    "description" "text",
    "incurred_on" "date" DEFAULT CURRENT_DATE NOT NULL,
    "recorded_by" "uuid",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "finance_entries_amount_inr_check" CHECK (("amount_inr" >= (0)::numeric)),
    CONSTRAINT "finance_entries_direction_check" CHECK (("direction" = ANY (ARRAY['in'::"text", 'out'::"text"]))),
    CONSTRAINT "finance_entries_entry_type_check" CHECK (("entry_type" = ANY (ARRAY['expense'::"text", 'govt_fee'::"text", 'vendor_payment'::"text", 'commission_payout'::"text", 'refund_to_client'::"text", 'adjustment'::"text", 'other_income'::"text"])))
);


ALTER TABLE "public"."finance_entries" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."integrations_config" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "code" "text" NOT NULL,
    "category" "text" NOT NULL,
    "display_name" "text" NOT NULL,
    "status" "text" DEFAULT 'not_connected'::"text" NOT NULL,
    "connected_as" "text",
    "region" "text",
    "fees_note" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "usage_30d" integer DEFAULT 0 NOT NULL,
    "last_used_at" timestamp with time zone,
    "is_active" boolean DEFAULT true NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."integrations_config" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."invoices" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "invoice_number" "text" NOT NULL,
    "case_id" "uuid",
    "client_id" "uuid" NOT NULL,
    "issued_at" timestamp with time zone DEFAULT "now"(),
    "due_date" "date",
    "currency" "text" DEFAULT 'INR'::"text" NOT NULL,
    "subtotal" numeric(12,2) NOT NULL,
    "tax" numeric(12,2) DEFAULT 0,
    "total" numeric(12,2) NOT NULL,
    "paid_total" numeric(12,2) DEFAULT 0,
    "status" "text" DEFAULT 'draft'::"text",
    "line_items" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "pdf_storage_path" "text",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "invoices_currency_check" CHECK (("currency" = ANY (ARRAY['INR'::"text", 'CAD'::"text", 'USD'::"text"]))),
    CONSTRAINT "invoices_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'sent'::"text", 'partial'::"text", 'paid'::"text", 'overdue'::"text", 'void'::"text"])))
);


ALTER TABLE "public"."invoices" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ircc_emails" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "gmail_message_id" "text",
    "gmail_thread_id" "text",
    "received_at" timestamp with time zone NOT NULL,
    "from_address" "text",
    "subject" "text",
    "body_text" "text",
    "body_html_storage_path" "text",
    "attachments" "jsonb" DEFAULT '[]'::"jsonb",
    "matched_case_id" "uuid",
    "email_type" "text",
    "requires_action" boolean DEFAULT false,
    "action_due_at" timestamp with time zone,
    "processed_by" "uuid",
    "processed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "keyword_flags" "text"[] DEFAULT '{}'::"text"[],
    "delivery_channel" "text" DEFAULT 'postmark'::"text",
    "notification_sent_at" timestamp with time zone
);


ALTER TABLE "public"."ircc_emails" OWNER TO "postgres";


COMMENT ON COLUMN "public"."ircc_emails"."delivery_channel" IS 'postmark | manual | gmail';



COMMENT ON COLUMN "public"."ircc_emails"."notification_sent_at" IS 'When the staff notification email was sent';



CREATE TABLE IF NOT EXISTS "public"."lead_deletions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "lead_id" "uuid" NOT NULL,
    "lead_snapshot" "jsonb" NOT NULL,
    "full_name" "text",
    "phone" "text",
    "email" "text",
    "lead_status" "text",
    "assigned_to" "uuid",
    "dependents" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "reason" "text" NOT NULL,
    "deleted_by" "uuid",
    "deleted_by_name" "text",
    "deleted_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."lead_deletions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."lead_nurture_targets" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "lead_id" "uuid" NOT NULL,
    "target_program_code" "text" NOT NULL,
    "eligible_at" "date" NOT NULL,
    "reason" "text",
    "cap_at" "date" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid",
    CONSTRAINT "lead_nurture_targets_cap_window_check" CHECK ((("cap_at" >= "eligible_at") AND ("cap_at" <= ("eligible_at" + '1 year'::interval)))),
    CONSTRAINT "lead_nurture_targets_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'eligible'::"text", 'pursued'::"text", 'abandoned'::"text"])))
);


ALTER TABLE "public"."lead_nurture_targets" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."lead_routing_rules" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "label" "text" NOT NULL,
    "priority" integer DEFAULT 100 NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "match_visa_type_codes" "text"[],
    "match_source_codes" "text"[],
    "match_office_hours_only" boolean DEFAULT false NOT NULL,
    "assign_strategy" "text" DEFAULT 'specific_staff'::"text" NOT NULL,
    "assign_staff_id" "uuid",
    "assign_role" "text",
    "assign_specialty" "text",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid"
);


ALTER TABLE "public"."lead_routing_rules" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."lead_sources" (
    "code" "text" NOT NULL,
    "label" "text" NOT NULL,
    "is_active" boolean DEFAULT true,
    "sort_order" integer DEFAULT 0
);


ALTER TABLE "public"."lead_sources" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."leads" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "full_name" "text" NOT NULL,
    "email" "text",
    "phone" "text",
    "country_of_residence" "text",
    "source_code" "text",
    "source_detail" "text",
    "status" "text" DEFAULT 'new'::"text" NOT NULL,
    "assessment_submitted_at" timestamp with time zone,
    "assessment_data" "jsonb",
    "crs_score" integer,
    "interested_visa_type_id" "uuid",
    "assigned_to" "uuid",
    "first_response_due_at" timestamp with time zone,
    "first_responded_at" timestamp with time zone,
    "converted_at" timestamp with time zone,
    "converted_client_id" "uuid",
    "lost_reason" "text",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "lifecycle_state" "text",
    "assessment_score" integer,
    "assessment_completed_at" timestamp with time zone,
    "country_of_interest" "text",
    "has_ircc_invitation" boolean DEFAULT false,
    "created_by" "uuid",
    "assessment_threshold_met" boolean,
    "ircc_invitation_type" "text",
    "nationality" "text",
    "referrer_name" "text",
    "waiting_reason" "text",
    "waiting_start_date" "date",
    "waiting_end_date" "date",
    "waiting_contact_frequency" "text",
    "waiting_review_notes" "text",
    "waiting_linked_milestone" "text",
    "stage_metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "referral_partner_id" "uuid",
    "family_unit_id" "uuid",
    "family_role" "text",
    "first_name" "text",
    "last_name" "text",
    "source_person_name" "text",
    "interested_visa_sub_type_id" "uuid",
    "agent_partner_id" "uuid",
    "enquiry_client_id" "uuid",
    "interested_category_id" "uuid",
    "interested_country" "text",
    CONSTRAINT "leads_lifecycle_state_check" CHECK (("lifecycle_state" = ANY (ARRAY['new_enquiry'::"text", 'contacted'::"text", 'assessed'::"text", 'proposal_sent'::"text", 'negotiating'::"text", 'waiting'::"text", 'nurturing'::"text", 'converted'::"text", 'cold'::"text", 'not_eligible'::"text", 'lost'::"text"]))),
    CONSTRAINT "leads_status_check" CHECK (("status" = ANY (ARRAY['new'::"text", 'contacted'::"text", 'qualified'::"text", 'assessment_sent'::"text", 'nurturing'::"text", 'converted'::"text", 'lost'::"text", 'duplicate'::"text"]))),
    CONSTRAINT "leads_waiting_frequency_check" CHECK ((("waiting_contact_frequency" IS NULL) OR ("waiting_contact_frequency" = ANY (ARRAY['weekly'::"text", 'bi_weekly'::"text", 'monthly'::"text", 'quarterly'::"text"])))),
    CONSTRAINT "leads_waiting_reason_check" CHECK ((("waiting_reason" IS NULL) OR ("waiting_reason" = ANY (ARRAY['ielts_pending'::"text", 'work_experience_incomplete'::"text", 'funds_arrangement'::"text", 'spouse_wp_pr_pending'::"text", 'pnp_intake_not_open'::"text", 'family_decision_pending'::"text", 'graduation_pending'::"text", 'permit_expiry_awaited'::"text", 'crs_score_improvement'::"text", 'medical_police_clearance'::"text", 'other'::"text"]))))
);


ALTER TABLE "public"."leads" OWNER TO "postgres";


COMMENT ON COLUMN "public"."leads"."lifecycle_state" IS 'Blueprint v1.0 stages. Active: new_enquiry→contacted→assessed→proposal_sent→negotiating. Waiting: waiting, nurturing. Terminal: converted, cold, not_eligible, lost.';



COMMENT ON COLUMN "public"."leads"."waiting_reason" IS 'Blueprint §4.2 approved waiting reasons';



COMMENT ON COLUMN "public"."leads"."waiting_end_date" IS 'Blueprint §4.1: counselor sets end date, 2 weeks to 12 months range';



COMMENT ON COLUMN "public"."leads"."waiting_review_notes" IS 'Blueprint §4.1: min 20 chars, what to discuss when period ends';



COMMENT ON COLUMN "public"."leads"."enquiry_client_id" IS 'When set, this lead is a NEW enquiry from an existing client. On convert, reuse that client (create a new application, not a new client).';



CREATE TABLE IF NOT EXISTS "public"."messages" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "channel" "text" NOT NULL,
    "direction" "text" NOT NULL,
    "lead_id" "uuid",
    "case_id" "uuid",
    "client_id" "uuid",
    "from_staff_id" "uuid",
    "from_contact" "text",
    "to_contact" "text",
    "subject" "text",
    "body" "text",
    "body_plain" "text" GENERATED ALWAYS AS ("regexp_replace"(COALESCE("body", ''::"text"), '<[^>]+>'::"text", ' '::"text", 'g'::"text")) STORED,
    "attachments" "jsonb" DEFAULT '[]'::"jsonb",
    "recording_storage_path" "text",
    "duration_seconds" integer,
    "external_message_id" "text",
    "is_read" boolean DEFAULT false,
    "read_at" timestamp with time zone,
    "sent_at" timestamp with time zone DEFAULT "now"(),
    "created_at" timestamp with time zone DEFAULT "now"(),
    "is_template" boolean DEFAULT false NOT NULL,
    "template_name" "text",
    "template_category" "text",
    "template_variables" "text"[] DEFAULT '{}'::"text"[],
    "status" "text" DEFAULT 'sent'::"text",
    "template_id" "uuid",
    "last_edited_by" "uuid",
    "last_edited_at" timestamp with time zone,
    CONSTRAINT "messages_channel_check" CHECK (("channel" = ANY (ARRAY['whatsapp'::"text", 'email'::"text", 'phone'::"text", 'portal_chat'::"text", 'sms'::"text", 'internal_note'::"text"]))),
    CONSTRAINT "messages_direction_check" CHECK (("direction" = ANY (ARRAY['inbound'::"text", 'outbound'::"text", 'internal'::"text"])))
);


ALTER TABLE "public"."messages" OWNER TO "postgres";


COMMENT ON COLUMN "public"."messages"."is_template" IS 'When true, this row is a reusable template, not an actual sent/received message';



COMMENT ON COLUMN "public"."messages"."template_variables" IS 'List of merge tag names available in body, e.g. {client_name, case_code, due_date}';



COMMENT ON COLUMN "public"."messages"."status" IS 'queued | sent | delivered | failed | bounced';



COMMENT ON COLUMN "public"."messages"."template_id" IS 'Reference to the template (also a messages row with is_template=true) used to compose this message';



CREATE TABLE IF NOT EXISTS "public"."staff_profiles" (
    "id" "uuid" NOT NULL,
    "full_name" "text" NOT NULL,
    "email" "text" NOT NULL,
    "phone" "text",
    "role" "text" NOT NULL,
    "visa_specialties" "text"[] DEFAULT '{}'::"text"[],
    "is_active" boolean DEFAULT true,
    "last_login_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "branch_code" "text",
    "performance_rating" numeric DEFAULT 4.50,
    "chain_misses_count" integer DEFAULT 0,
    CONSTRAINT "staff_profiles_role_check" CHECK (("role" = ANY (ARRAY['owner'::"text", 'admin'::"text", 'intake_officer'::"text", 'case_manager'::"text", 'filing_officer'::"text", 'filing_parttime'::"text", 'accounts'::"text", 'senior_counsellor'::"text", 'counsellor'::"text", 'tele_counsellor'::"text", 'visa_expert'::"text", 'filer_manager'::"text", 'filer'::"text", 'reception'::"text", 'sales'::"text", 'marketing'::"text", 'hr'::"text", 'senior_advisor'::"text", 'document_specialist'::"text", 'support'::"text", 'accountant'::"text"])))
);


ALTER TABLE "public"."staff_profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tasks" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "case_id" "uuid",
    "lead_id" "uuid",
    "title" "text" NOT NULL,
    "description" "text",
    "status_code" "text" DEFAULT 'open'::"text",
    "priority" "text" DEFAULT 'normal'::"text",
    "assigned_to" "uuid",
    "created_by" "uuid",
    "due_date" "date",
    "due_at" timestamp with time zone,
    "sla_rule_code" "text",
    "completed_at" timestamp with time zone,
    "source" "text" DEFAULT 'manual'::"text",
    "trigger_event_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "kind" "text" DEFAULT 'general'::"text" NOT NULL,
    "task_key" "text",
    "superseded_by" "uuid",
    "acknowledged_at" timestamp with time zone,
    "acknowledged_by" "uuid",
    "closed_note" "text",
    CONSTRAINT "tasks_check" CHECK ((("case_id" IS NOT NULL) OR ("lead_id" IS NOT NULL))),
    CONSTRAINT "tasks_kind_check" CHECK (("kind" = ANY (ARRAY['general'::"text", 'follow_up'::"text", 'document_review'::"text", 'application_prep'::"text", 'phone_call'::"text", 'client_meeting'::"text", 'other'::"text"]))),
    CONSTRAINT "tasks_priority_check" CHECK (("priority" = ANY (ARRAY['low'::"text", 'normal'::"text", 'high'::"text", 'urgent'::"text"])))
);


ALTER TABLE "public"."tasks" OWNER TO "postgres";


CREATE MATERIALIZED VIEW "public"."mv_cases_at_risk" AS
 SELECT "c"."id",
    "c"."case_code",
    "c"."client_id",
    "cl"."full_name" AS "client_name",
    "c"."current_stage_code",
    "c"."risk_level",
    "c"."target_submission_date",
    "c"."case_manager_id",
    "sp"."full_name" AS "case_manager_name",
    ( SELECT "count"(*) AS "count"
           FROM "public"."tasks" "t"
          WHERE (("t"."case_id" = "c"."id") AND ("t"."status_code" <> ALL (ARRAY['done'::"text", 'cancelled'::"text"])) AND ("t"."due_date" < CURRENT_DATE))) AS "overdue_task_count",
    ( SELECT "max"("m"."sent_at") AS "max"
           FROM "public"."messages" "m"
          WHERE ("m"."case_id" = "c"."id")) AS "last_comm_at"
   FROM (("public"."cases" "c"
     JOIN "public"."clients" "cl" ON (("cl"."id" = "c"."client_id")))
     LEFT JOIN "public"."staff_profiles" "sp" ON (("sp"."id" = "c"."case_manager_id")))
  WHERE (("c"."is_archived" = false) AND ("c"."risk_level" = ANY (ARRAY['yellow'::"text", 'red'::"text"])))
  WITH NO DATA;


ALTER MATERIALIZED VIEW "public"."mv_cases_at_risk" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."payments" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "invoice_id" "uuid" NOT NULL,
    "amount" numeric(12,2) NOT NULL,
    "currency" "text" NOT NULL,
    "provider" "text",
    "provider_reference" "text",
    "provider_payload" "jsonb",
    "paid_at" timestamp with time zone DEFAULT "now"(),
    "status" "text" DEFAULT 'succeeded'::"text",
    "refund_reference" "text",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "payments_provider_check" CHECK (("provider" = ANY (ARRAY['razorpay'::"text", 'stripe'::"text", 'upi'::"text", 'interac'::"text", 'bank_transfer'::"text", 'cash'::"text", 'cheque'::"text", 'other'::"text"]))),
    CONSTRAINT "payments_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'succeeded'::"text", 'failed'::"text", 'refunded'::"text", 'partially_refunded'::"text"])))
);


ALTER TABLE "public"."payments" OWNER TO "postgres";


CREATE MATERIALIZED VIEW "public"."mv_dashboard_kpis" AS
 SELECT ( SELECT "count"(*) AS "count"
           FROM "public"."leads"
          WHERE ("leads"."status" <> ALL (ARRAY['converted'::"text", 'lost'::"text", 'duplicate'::"text"]))) AS "active_leads",
    ( SELECT "count"(*) AS "count"
           FROM "public"."leads"
          WHERE (("leads"."first_response_due_at" < "now"()) AND ("leads"."first_responded_at" IS NULL))) AS "sla_breaches",
    ( SELECT "count"(*) AS "count"
           FROM "public"."cases"
          WHERE (("cases"."is_archived" = false) AND ("cases"."current_stage_code" <> ALL (ARRAY['approved'::"text", 'refused'::"text", 'withdrawn'::"text"])))) AS "active_cases",
    ( SELECT "count"(*) AS "count"
           FROM "public"."cases"
          WHERE (("cases"."is_archived" = false) AND ("cases"."risk_level" = 'red'::"text"))) AS "cases_red_risk",
    ( SELECT "count"(*) AS "count"
           FROM "public"."cases"
          WHERE (("cases"."is_archived" = false) AND ("cases"."risk_level" = 'yellow'::"text"))) AS "cases_yellow_risk",
    ( SELECT "count"(*) AS "count"
           FROM "public"."tasks"
          WHERE (("tasks"."status_code" <> ALL (ARRAY['done'::"text", 'cancelled'::"text"])) AND ("tasks"."due_date" < CURRENT_DATE))) AS "overdue_tasks",
    ( SELECT COALESCE("sum"("invoices"."total"), (0)::numeric) AS "coalesce"
           FROM "public"."invoices"
          WHERE ("date_trunc"('month'::"text", "invoices"."issued_at") = "date_trunc"('month'::"text", "now"()))) AS "mtd_invoiced",
    ( SELECT COALESCE("sum"("payments"."amount"), (0)::numeric) AS "coalesce"
           FROM "public"."payments"
          WHERE (("date_trunc"('month'::"text", "payments"."paid_at") = "date_trunc"('month'::"text", "now"())) AND ("payments"."status" = 'succeeded'::"text"))) AS "mtd_collected",
    ( SELECT "count"(*) AS "count"
           FROM "public"."cases"
          WHERE ("date_trunc"('month'::"text", "cases"."submitted_at") = "date_trunc"('month'::"text", "now"()))) AS "mtd_submitted",
    ( SELECT "count"(*) AS "count"
           FROM "public"."cases"
          WHERE (("date_trunc"('month'::"text", "cases"."decision_at") = "date_trunc"('month'::"text", "now"())) AND ("cases"."outcome" = 'approved'::"text"))) AS "mtd_approved",
    "now"() AS "refreshed_at"
  WITH NO DATA;


ALTER MATERIALIZED VIEW "public"."mv_dashboard_kpis" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."office_holidays" (
    "date" "date" NOT NULL,
    "label" "text" NOT NULL,
    "country" "text" DEFAULT 'CA'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid"
);


ALTER TABLE "public"."office_holidays" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."office_hours_config" (
    "weekday" integer NOT NULL,
    "open_time" time without time zone,
    "close_time" time without time zone,
    "is_closed" boolean DEFAULT false NOT NULL,
    "timezone" "text" DEFAULT 'America/Toronto'::"text" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_by" "uuid",
    CONSTRAINT "office_hours_config_weekday_check" CHECK ((("weekday" >= 0) AND ("weekday" <= 6)))
);


ALTER TABLE "public"."office_hours_config" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."office_settings" (
    "key" "text" NOT NULL,
    "value" "jsonb" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_by" "uuid"
);


ALTER TABLE "public"."office_settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."orgs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "code" "text" NOT NULL,
    "name" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."orgs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."outbound_messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "channel" "text" NOT NULL,
    "template_code" "text",
    "to_contact" "text" NOT NULL,
    "subject" "text",
    "body" "text",
    "variables" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "related_case_id" "uuid",
    "related_lead_id" "uuid",
    "related_client_id" "uuid",
    "trigger_event_id" "uuid",
    "scheduled_for" timestamp with time zone DEFAULT "now"() NOT NULL,
    "sent_at" timestamp with time zone,
    "status" "text" DEFAULT 'queued'::"text" NOT NULL,
    "error_message" "text",
    "attempts" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid"
);


ALTER TABLE "public"."outbound_messages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."program_eligibility_rules" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "visa_code" "text" NOT NULL,
    "version" "text" DEFAULT '2026.07'::"text" NOT NULL,
    "rule_code" "text" NOT NULL,
    "label" "text" NOT NULL,
    "rule_type" "text" NOT NULL,
    "weight" integer DEFAULT 10 NOT NULL,
    "condition" "jsonb" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    CONSTRAINT "program_eligibility_rules_rule_type_check" CHECK (("rule_type" = ANY (ARRAY['hard_gate'::"text", 'weighted'::"text"])))
);


ALTER TABLE "public"."program_eligibility_rules" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."prospective_applications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "family_unit_id" "uuid",
    "for_person_id" "uuid",
    "for_person_type" "text",
    "triggered_by_rule" "uuid",
    "source_case_id" "uuid",
    "promoted_case_id" "uuid",
    "target_application_type" "text" NOT NULL,
    "trigger_date" "date" NOT NULL,
    "expires_on" "date",
    "status" "text" DEFAULT 'pending_counselor_action'::"text",
    "estimated_fee_cad" numeric,
    "assigned_counselor_id" "uuid",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "prospective_applications_for_person_type_check" CHECK (("for_person_type" = ANY (ARRAY['lead'::"text", 'client'::"text"]))),
    CONSTRAINT "prospective_applications_status_check" CHECK (("status" = ANY (ARRAY['pending_counselor_action'::"text", 'converted_to_case'::"text", 'declined_by_client'::"text", 'snoozed'::"text", 'expired'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."prospective_applications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."questionnaire_questions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "section_id" "uuid" NOT NULL,
    "field_code" "text" NOT NULL,
    "label" "text" NOT NULL,
    "field_type" "text" NOT NULL,
    "is_required" boolean DEFAULT false NOT NULL,
    "default_value" "jsonb",
    "options" "jsonb",
    "validation" "jsonb",
    "placeholder" "text",
    "help_text" "text",
    "visibility_rule" "jsonb",
    "auto_trigger" "jsonb",
    "sort_order" integer DEFAULT 0 NOT NULL,
    "scoring_tags" "text"[],
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "questionnaire_questions_field_type_check" CHECK (("field_type" = ANY (ARRAY['text'::"text", 'textarea'::"text", 'number'::"text", 'date'::"text", 'boolean'::"text", 'select_one'::"text", 'select_many'::"text", 'country'::"text", 'currency'::"text", 'phone'::"text", 'email'::"text", 'array_record'::"text", 'language_test_block'::"text"])))
);


ALTER TABLE "public"."questionnaire_questions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."questionnaire_response_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "response_id" "uuid" NOT NULL,
    "question_id" "uuid" NOT NULL,
    "value" "jsonb",
    "is_skipped" boolean DEFAULT false NOT NULL,
    "skip_reason" "text",
    "answered_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."questionnaire_response_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."questionnaire_responses" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "template_id" "uuid" NOT NULL,
    "lead_id" "uuid",
    "case_id" "uuid",
    "applicant_id" "uuid",
    "status" "text" DEFAULT 'in_progress'::"text" NOT NULL,
    "score" numeric(5,2),
    "threshold_met" boolean,
    "submitted_at" timestamp with time zone,
    "reviewed_at" timestamp with time zone,
    "reviewed_by" "uuid",
    "review_notes" "text",
    "last_autosaved_at" timestamp with time zone,
    "completion_pct" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "questionnaire_responses_lead_or_case" CHECK (((("lead_id" IS NOT NULL) AND ("case_id" IS NULL)) OR (("lead_id" IS NULL) AND ("case_id" IS NOT NULL)))),
    CONSTRAINT "questionnaire_responses_status_check" CHECK (("status" = ANY (ARRAY['in_progress'::"text", 'submitted'::"text", 'reviewed'::"text", 'declined'::"text"])))
);


ALTER TABLE "public"."questionnaire_responses" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."questionnaire_sections" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "template_id" "uuid" NOT NULL,
    "code" "text" NOT NULL,
    "label" "text" NOT NULL,
    "description" "text",
    "sort_order" integer DEFAULT 0 NOT NULL,
    "visibility_rule" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."questionnaire_sections" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."questionnaire_templates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "code" "text" NOT NULL,
    "label" "text" NOT NULL,
    "visa_type_code" "text",
    "version_label" "text" DEFAULT '1'::"text" NOT NULL,
    "is_current" boolean DEFAULT true NOT NULL,
    "description" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid"
);


ALTER TABLE "public"."questionnaire_templates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."referral_partners" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "email" "text",
    "phone" "text",
    "company" "text",
    "commission_rate" numeric(6,2),
    "commission_type" "text",
    "notes" "text",
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "referral_partners_commission_type_check" CHECK (("commission_type" = ANY (ARRAY['percentage'::"text", 'fixed'::"text"])))
);


ALTER TABLE "public"."referral_partners" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sla_rules" (
    "code" "text" NOT NULL,
    "label" "text" NOT NULL,
    "applies_to" "text" NOT NULL,
    "target_minutes" integer NOT NULL,
    "office_hours_only" boolean DEFAULT true,
    "escalate_to_role" "text",
    "is_active" boolean DEFAULT true,
    "reminder_minutes" integer,
    "hard_deadline_action" "text",
    CONSTRAINT "sla_rules_applies_to_check" CHECK (("applies_to" = ANY (ARRAY['lead'::"text", 'case'::"text", 'document'::"text", 'ircc_comm'::"text", 'portal_message'::"text"])))
);


ALTER TABLE "public"."sla_rules" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."step_conditions" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "step_template_id" "uuid" NOT NULL,
    "condition" "jsonb" NOT NULL,
    "action" "text" NOT NULL,
    "alternate_step_id" "uuid",
    "notes" "text",
    CONSTRAINT "step_conditions_action_check" CHECK (("action" = ANY (ARRAY['skip'::"text", 'require'::"text", 'alternate_path'::"text", 'escalate'::"text"])))
);


ALTER TABLE "public"."step_conditions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."step_template_edits" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "step_template_id" "uuid",
    "proposed_by" "uuid",
    "proposed_at" timestamp with time zone DEFAULT "now"(),
    "proposed_change" "jsonb" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text",
    "reviewed_by" "uuid",
    "reviewed_at" timestamp with time zone,
    "review_notes" "text",
    "applied_version" integer,
    "rollback_from_version" integer,
    CONSTRAINT "step_template_edits_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'approved'::"text", 'rejected'::"text", 'auto_applied'::"text"])))
);


ALTER TABLE "public"."step_template_edits" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."step_templates" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "visa_sub_type_id" "uuid",
    "step_code" "text" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "sort_order" integer DEFAULT 0,
    "sla_rule_code" "text",
    "assigned_role" "text",
    "is_active" boolean DEFAULT true,
    "version" integer DEFAULT 1,
    "step_type" "text" DEFAULT 'task'::"text" NOT NULL,
    "due_offset_days" integer
);


ALTER TABLE "public"."step_templates" OWNER TO "postgres";


COMMENT ON COLUMN "public"."step_templates"."step_type" IS 'task | document | email | wait | condition';



COMMENT ON COLUMN "public"."step_templates"."due_offset_days" IS 'Days from stage entry by which this step should complete';



CREATE TABLE IF NOT EXISTS "public"."task_statuses_ref" (
    "code" "text" NOT NULL,
    "label" "text" NOT NULL,
    "is_terminal" boolean DEFAULT false
);


ALTER TABLE "public"."task_statuses_ref" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."trigger_events" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "trigger_code" "text",
    "client_id" "uuid",
    "case_id" "uuid",
    "fired_at" timestamp with time zone DEFAULT "now"(),
    "outcome" "text",
    "created_task_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "trigger_events_outcome_check" CHECK ((("outcome" IS NULL) OR ("outcome" = ANY (ARRAY['pending'::"text", 'contacted'::"text", 'interested'::"text", 'converted'::"text", 'declined'::"text", 'expired'::"text", 'fired'::"text", 'task_created'::"text", 'escalated'::"text", 'queued'::"text", 'sent'::"text", 'failed'::"text", 'cancelled'::"text", 'skipped'::"text"]))))
);


ALTER TABLE "public"."trigger_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."upsell_triggers" (
    "code" "text" NOT NULL,
    "label" "text" NOT NULL,
    "description" "text",
    "trigger_condition" "jsonb" NOT NULL,
    "offer_visa_code" "text",
    "delay_days" integer DEFAULT 0,
    "is_active" boolean DEFAULT true,
    "sort_order" integer DEFAULT 0
);


ALTER TABLE "public"."upsell_triggers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."visa_types" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "code" "text" NOT NULL,
    "label" "text" NOT NULL,
    "category" "text" NOT NULL,
    "base_fee_inr" numeric(10,0) DEFAULT 0,
    "base_fee_cad" numeric(10,2) DEFAULT 0,
    "govt_fee_cad" numeric(10,2) DEFAULT 0,
    "is_active" boolean DEFAULT true,
    "notes" "text",
    "requires_canada_residency" boolean DEFAULT false,
    "is_commission_based" boolean DEFAULT false,
    "destination_country" "text",
    "category_id" "uuid"
);


ALTER TABLE "public"."visa_types" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_application_family_chain" WITH ("security_invoker"='true') AS
 WITH "fam" AS (
         SELECT "c"."id" AS "application_id",
            "cl"."id" AS "client_id",
            "cl"."family_unit_id"
           FROM ("public"."cases" "c"
             JOIN "public"."clients" "cl" ON (("cl"."id" = "c"."client_id")))
        )
 SELECT "f"."application_id",
    "f"."family_unit_id",
    "member"."id" AS "member_client_id",
    "member"."full_name" AS "member_name",
    "member"."family_role" AS "member_role",
    "member"."date_of_birth",
    "mc"."id" AS "member_application_id",
    "mc"."case_code" AS "member_application_code",
    "mc"."current_stage_code" AS "member_stage",
    "mc"."outcome" AS "member_outcome",
    "vt"."label" AS "member_visa_type",
    ("member"."id" = "f"."client_id") AS "is_principal"
   FROM ((("fam" "f"
     JOIN "public"."clients" "member" ON (("member"."family_unit_id" = "f"."family_unit_id")))
     LEFT JOIN "public"."cases" "mc" ON ((("mc"."client_id" = "member"."id") AND (COALESCE("mc"."is_archived", false) = false))))
     LEFT JOIN "public"."visa_types" "vt" ON (("vt"."id" = "mc"."visa_type_id")))
  WHERE ("f"."family_unit_id" IS NOT NULL);


ALTER VIEW "public"."v_application_family_chain" OWNER TO "postgres";


COMMENT ON VIEW "public"."v_application_family_chain" IS 'Every family member linked to an application, with their own application,
   stage and visa type. Powers the Family panel in the Applications module.';



CREATE OR REPLACE VIEW "public"."v_assessment_answers" WITH ("security_invoker"='true') AS
 SELECT "r"."id" AS "response_id",
    "r"."lead_id",
    "r"."case_id",
    "r"."applicant_id",
    "r"."status" AS "response_status",
    "r"."completion_pct",
    "t"."code" AS "template_code",
    "t"."label" AS "template_label",
    "s"."sort_order" AS "section_order",
    "s"."code" AS "section_code",
    "s"."label" AS "section_label",
    "q"."sort_order" AS "question_order",
    "q"."field_code",
    "q"."label" AS "question",
    "q"."field_type",
    "q"."scoring_tags",
    "i"."value" AS "answer",
    "i"."is_skipped",
    "i"."skip_reason",
    "i"."answered_at"
   FROM (((("public"."questionnaire_responses" "r"
     JOIN "public"."questionnaire_templates" "t" ON (("t"."id" = "r"."template_id")))
     JOIN "public"."questionnaire_sections" "s" ON (("s"."template_id" = "t"."id")))
     JOIN "public"."questionnaire_questions" "q" ON (("q"."section_id" = "s"."id")))
     LEFT JOIN "public"."questionnaire_response_items" "i" ON ((("i"."response_id" = "r"."id") AND ("i"."question_id" = "q"."id"))));


ALTER VIEW "public"."v_assessment_answers" OWNER TO "postgres";


COMMENT ON VIEW "public"."v_assessment_answers" IS 'Every question with its answer, in section/question order. Renders the
   answers block BELOW the results on the Assessment page.';



CREATE OR REPLACE VIEW "public"."v_assessment_summary" WITH ("security_invoker"='true') AS
 SELECT "id" AS "assessment_id",
    "lead_id",
    "client_id",
    "form_code",
    "status",
    "submitted_at",
    "scored_at",
    "reviewed_by",
    "score_results",
    "facts",
    ("score_results" -> 'crs'::"text") AS "crs_score",
    ("score_results" -> 'provinces'::"text") AS "province_scores",
    ("score_results" -> 'recommended'::"text") AS "recommended_programs",
    ("facts" ->> 'occupation_title'::"text") AS "current_occupation",
    ("facts" ->> 'noc_code'::"text") AS "noc_code",
    ("facts" ->> 'teer'::"text") AS "teer",
    ("facts" ->> 'canada_work_start_date'::"text") AS "canada_work_start_date"
   FROM "public"."assessments" "a";


ALTER VIEW "public"."v_assessment_summary" OWNER TO "postgres";


COMMENT ON VIEW "public"."v_assessment_summary" IS 'Assessment results header — CRS, per-province scores, recommendations,
   current occupation/NOC/TEER. Top of the Assessment page + Overview tab.';



CREATE OR REPLACE VIEW "public"."v_branch_health" AS
 SELECT COALESCE("branch_code", 'UNASSIGNED'::"text") AS "branch_code",
    "count"(DISTINCT "id") AS "counselor_count",
    "round"("avg"(COALESCE("performance_rating", 4.50)), 2) AS "avg_rating",
    ( SELECT "count"(*) AS "count"
           FROM "public"."prospective_applications" "pa"
          WHERE (("pa"."assigned_counselor_id" IN ( SELECT "sp2"."id"
                   FROM "public"."staff_profiles" "sp2"
                  WHERE (COALESCE("sp2"."branch_code", 'UNASSIGNED'::"text") = COALESCE("sp"."branch_code", 'UNASSIGNED'::"text")))) AND ("pa"."status" = 'pending_counselor_action'::"text"))) AS "pending_prospectives",
    ( SELECT "count"(*) AS "count"
           FROM "public"."tasks" "t"
          WHERE (("t"."assigned_to" IN ( SELECT "sp2"."id"
                   FROM "public"."staff_profiles" "sp2"
                  WHERE (COALESCE("sp2"."branch_code", 'UNASSIGNED'::"text") = COALESCE("sp"."branch_code", 'UNASSIGNED'::"text")))) AND ("t"."status_code" <> 'completed'::"text") AND ("t"."due_at" IS NOT NULL) AND (("t"."due_at")::"date" < CURRENT_DATE) AND ("t"."created_at" >= ("now"() - '30 days'::interval)))) AS "breaches_30d"
   FROM "public"."staff_profiles" "sp"
  WHERE (COALESCE("is_active", true) = true)
  GROUP BY "branch_code";


ALTER VIEW "public"."v_branch_health" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_case_financials" WITH ("security_invoker"='true') AS
 SELECT "ca"."id" AS "case_id",
    "ca"."case_code",
    "ca"."client_id",
    COALESCE("ca"."quoted_fee_inr", (0)::numeric) AS "quoted_fee_inr",
    COALESCE("pay"."total", (0)::numeric) AS "payments_received_inr",
    COALESCE("led_out"."total", (0)::numeric) AS "ledger_outflow_inr",
    COALESCE("led_in"."total", (0)::numeric) AS "ledger_inflow_inr",
    COALESCE("com"."total", (0)::numeric) AS "commissions_accrued_inr",
    (COALESCE("ca"."quoted_fee_inr", (0)::numeric) - COALESCE("pay"."total", (0)::numeric)) AS "balance_due_inr",
    (((COALESCE("pay"."total", (0)::numeric) + COALESCE("led_in"."total", (0)::numeric)) - COALESCE("led_out"."total", (0)::numeric)) - COALESCE("com"."total", (0)::numeric)) AS "net_position_inr"
   FROM (((("public"."cases" "ca"
     LEFT JOIN LATERAL ( SELECT "sum"("p"."amount") AS "total"
           FROM ("public"."payments" "p"
             JOIN "public"."invoices" "i" ON (("i"."id" = "p"."invoice_id")))
          WHERE (("i"."case_id" = "ca"."id") AND ("p"."status" = 'succeeded'::"text"))) "pay" ON (true))
     LEFT JOIN LATERAL ( SELECT "sum"("fe"."amount_inr") AS "total"
           FROM "public"."finance_entries" "fe"
          WHERE (("fe"."case_id" = "ca"."id") AND ("fe"."direction" = 'out'::"text"))) "led_out" ON (true))
     LEFT JOIN LATERAL ( SELECT "sum"("fe"."amount_inr") AS "total"
           FROM "public"."finance_entries" "fe"
          WHERE (("fe"."case_id" = "ca"."id") AND ("fe"."direction" = 'in'::"text"))) "led_in" ON (true))
     LEFT JOIN LATERAL ( SELECT "sum"("cm"."amount_inr") AS "total"
           FROM "public"."commissions" "cm"
          WHERE (("cm"."case_id" = "ca"."id") AND ("cm"."status" = ANY (ARRAY['accrued'::"text", 'approved'::"text", 'paid'::"text"])))) "com" ON (true));


ALTER VIEW "public"."v_case_financials" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_case_notes" WITH ("security_invoker"='true') AS
 SELECT "ca"."id" AS "for_case_id",
    "n"."id",
    "n"."lead_id",
    "n"."client_id",
    "n"."case_id",
    "n"."note_type",
    "n"."body",
    "n"."is_locked",
    "n"."locked_at",
    "n"."locked_by",
    "n"."unlocked_at",
    "n"."unlocked_by",
    "n"."created_by",
    "n"."created_at",
    "n"."updated_at",
    "n"."migrated_from"
   FROM (("public"."cases" "ca"
     LEFT JOIN "public"."clients" "cl" ON (("cl"."id" = "ca"."client_id")))
     JOIN "public"."entity_notes" "n" ON ((("n"."case_id" = "ca"."id") OR (("n"."client_id" IS NOT NULL) AND ("n"."client_id" = "ca"."client_id")) OR (("n"."lead_id" IS NOT NULL) AND ("n"."lead_id" = "cl"."source_lead_id")))));


ALTER VIEW "public"."v_case_notes" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_case_timeline" WITH ("security_invoker"='true') AS
 SELECT "ca"."id" AS "for_case_id",
    "t"."id",
    "t"."lead_id",
    "t"."case_id",
    "t"."client_id",
    "t"."event_type",
    "t"."title",
    "t"."body",
    "t"."metadata",
    "t"."actor_id",
    "t"."is_system",
    "t"."occurred_at",
    "t"."created_at"
   FROM (("public"."cases" "ca"
     LEFT JOIN "public"."clients" "cl" ON (("cl"."id" = "ca"."client_id")))
     JOIN "public"."activity_timeline" "t" ON ((("t"."case_id" = "ca"."id") OR (("t"."client_id" IS NOT NULL) AND ("t"."client_id" = "ca"."client_id")) OR (("t"."lead_id" IS NOT NULL) AND ("t"."lead_id" = "cl"."source_lead_id")))));


ALTER VIEW "public"."v_case_timeline" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_cases_masked" WITH ("security_invoker"='false') AS
 SELECT "c"."id",
    "c"."case_code",
    "c"."current_stage_code",
    "vt"."label" AS "program",
    ((("left"("cl"."full_name", 1) || '.'::"text") || COALESCE("left"("split_part"("cl"."full_name", ' '::"text", 2), 1), ''::"text")) || '.'::"text") AS "applicant",
    "c"."created_at"
   FROM (("public"."cases" "c"
     JOIN "public"."clients" "cl" ON (("cl"."id" = "c"."client_id")))
     LEFT JOIN "public"."visa_types" "vt" ON (("vt"."id" = "c"."visa_type_id")))
  WHERE ("public"."fn_is_filing_pt"() OR "public"."fn_is_owner_admin"());


ALTER VIEW "public"."v_cases_masked" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_client_family_chain" WITH ("security_invoker"='true') AS
 SELECT "base"."id" AS "for_client_id",
    "base"."family_unit_id",
    "member"."id" AS "member_client_id",
    "member"."full_name" AS "member_name",
    "member"."family_role" AS "member_role",
    "mc"."id" AS "member_application_id",
    "mc"."case_code" AS "member_application_code",
    "mc"."current_stage_code" AS "member_stage",
    "mc"."outcome" AS "member_outcome",
    ("member"."id" = "base"."id") AS "is_self"
   FROM (("public"."clients" "base"
     JOIN "public"."clients" "member" ON (("member"."family_unit_id" = "base"."family_unit_id")))
     LEFT JOIN "public"."cases" "mc" ON ((("mc"."client_id" = "member"."id") AND (COALESCE("mc"."is_archived", false) = false))))
  WHERE ("base"."family_unit_id" IS NOT NULL);


ALTER VIEW "public"."v_client_family_chain" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_clients_accounts" WITH ("security_invoker"='false') AS
 SELECT "id",
    "client_code",
    "full_name"
   FROM "public"."clients" "cl"
  WHERE ("public"."fn_is_accounts"() OR "public"."fn_is_owner_admin"());


ALTER VIEW "public"."v_clients_accounts" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_contact_reveal_anomalies" WITH ("security_invoker"='on') AS
 SELECT "sp"."full_name" AS "staff_name",
    "r"."staff_id",
    ("date_trunc"('day'::"text", "r"."revealed_at"))::"date" AS "day",
    "count"(*) AS "reveals",
    "count"(DISTINCT "r"."entity_id") AS "distinct_records",
        CASE
            WHEN ("count"(*) >= 30) THEN 'red'::"text"
            WHEN ("count"(*) >= 15) THEN 'amber'::"text"
            ELSE 'ok'::"text"
        END AS "flag"
   FROM ("public"."contact_reveal_log" "r"
     JOIN "public"."staff_profiles" "sp" ON (("sp"."id" = "r"."staff_id")))
  GROUP BY "sp"."full_name", "r"."staff_id", ("date_trunc"('day'::"text", "r"."revealed_at"))
  ORDER BY (("date_trunc"('day'::"text", "r"."revealed_at"))::"date") DESC, ("count"(*)) DESC;


ALTER VIEW "public"."v_contact_reveal_anomalies" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_counselor_performance" AS
 SELECT "id" AS "counselor_id",
    "full_name",
    "branch_code",
    "performance_rating",
    "chain_misses_count",
    ( SELECT "count"(*) AS "count"
           FROM "public"."tasks" "t"
          WHERE (("t"."assigned_to" = "sp"."id") AND ("t"."created_at" >= ("now"() - '30 days'::interval)))) AS "chain_tasks_30d",
    ( SELECT "count"(*) AS "count"
           FROM "public"."tasks" "t"
          WHERE (("t"."assigned_to" = "sp"."id") AND ("t"."status_code" = 'completed'::"text") AND ("t"."completed_at" >= ("now"() - '30 days'::interval)) AND (("t"."due_at" IS NULL) OR (("t"."completed_at")::"date" <= ("t"."due_at")::"date")))) AS "chain_tasks_on_time_30d",
    ( SELECT "count"(*) AS "count"
           FROM "public"."tasks" "t"
          WHERE (("t"."assigned_to" = "sp"."id") AND ("t"."status_code" <> 'completed'::"text") AND ("t"."due_at" IS NOT NULL) AND (("t"."due_at")::"date" < CURRENT_DATE) AND ("t"."created_at" >= ("now"() - '30 days'::interval)))) AS "sla_breaches_30d",
    ( SELECT "count"(*) AS "count"
           FROM "public"."prospective_applications" "pa"
          WHERE (("pa"."assigned_counselor_id" = "sp"."id") AND ("pa"."status" = 'pending_counselor_action'::"text"))) AS "pending_prospectives",
    ( SELECT "count"(*) AS "count"
           FROM "public"."cases" "c"
          WHERE ((("c"."case_manager_id" = "sp"."id") OR ("c"."senior_advisor_id" = "sp"."id")) AND ("c"."outcome" IS NULL) AND (COALESCE("c"."is_archived", false) = false))) AS "active_cases",
    ( SELECT COALESCE("sum"("c"."quoted_fee_inr"), (0)::numeric) AS "coalesce"
           FROM "public"."cases" "c"
          WHERE ((("c"."case_manager_id" = "sp"."id") OR ("c"."senior_advisor_id" = "sp"."id")) AND ("c"."outcome" = 'approved'::"text") AND ("c"."decision_at" >= ("now"() - '90 days'::interval)))) AS "revenue_90d"
   FROM "public"."staff_profiles" "sp"
  WHERE (COALESCE("is_active", true) = true);


ALTER VIEW "public"."v_counselor_performance" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_followup_integrity" WITH ("security_invoker"='on') AS
 WITH "active_leads" AS (
         SELECT "l_1"."id",
            "l_1"."full_name",
            "l_1"."email",
            "l_1"."phone",
            "l_1"."country_of_residence",
            "l_1"."source_code",
            "l_1"."source_detail",
            "l_1"."status",
            "l_1"."assessment_submitted_at",
            "l_1"."assessment_data",
            "l_1"."crs_score",
            "l_1"."interested_visa_type_id",
            "l_1"."assigned_to",
            "l_1"."first_response_due_at",
            "l_1"."first_responded_at",
            "l_1"."converted_at",
            "l_1"."converted_client_id",
            "l_1"."lost_reason",
            "l_1"."notes",
            "l_1"."created_at",
            "l_1"."updated_at",
            "l_1"."lifecycle_state",
            "l_1"."assessment_score",
            "l_1"."assessment_completed_at",
            "l_1"."country_of_interest",
            "l_1"."has_ircc_invitation",
            "l_1"."created_by",
            "l_1"."assessment_threshold_met",
            "l_1"."ircc_invitation_type",
            "l_1"."nationality",
            "l_1"."referrer_name",
            "l_1"."waiting_reason",
            "l_1"."waiting_start_date",
            "l_1"."waiting_end_date",
            "l_1"."waiting_contact_frequency",
            "l_1"."waiting_review_notes",
            "l_1"."waiting_linked_milestone",
            "l_1"."stage_metadata",
            "l_1"."referral_partner_id",
            "l_1"."family_unit_id",
            "l_1"."family_role",
            "l_1"."first_name",
            "l_1"."last_name",
            "l_1"."source_person_name",
            "l_1"."interested_visa_sub_type_id",
            "l_1"."agent_partner_id"
           FROM "public"."leads" "l_1"
          WHERE (COALESCE("l_1"."lifecycle_state", "l_1"."status", 'new_enquiry'::"text") = ANY (ARRAY['new_enquiry'::"text", 'contacted'::"text", 'assessed'::"text", 'proposal_sent'::"text", 'negotiating'::"text", 'waiting'::"text"]))
        ), "last_msg" AS (
         SELECT "m"."lead_id",
            "max"(COALESCE("m"."sent_at", "m"."created_at")) AS "at"
           FROM "public"."messages" "m"
          WHERE (("m"."lead_id" IS NOT NULL) AND ("lower"(COALESCE("m"."direction", 'outbound'::"text")) = ANY (ARRAY['outbound'::"text", 'outgoing'::"text", 'sent'::"text"])))
          GROUP BY "m"."lead_id"
        ), "last_call" AS (
         SELECT "c"."lead_id",
            "max"("c"."called_at") AS "at",
            "max"("c"."next_contact_at") AS "next_contact_at"
           FROM "public"."call_logs" "c"
          WHERE ("c"."lead_id" IS NOT NULL)
          GROUP BY "c"."lead_id"
        ), "last_activity" AS (
         SELECT "t"."lead_id",
            "max"(COALESCE("t"."occurred_at", "t"."created_at")) AS "at"
           FROM "public"."activity_timeline" "t"
          WHERE (("t"."lead_id" IS NOT NULL) AND ("t"."event_type" = ANY (ARRAY['message_sent'::"text", 'whatsapp_sent'::"text", 'email_sent'::"text", 'call_logged'::"text", 'note_added'::"text"])))
          GROUP BY "t"."lead_id"
        ), "next_task" AS (
         SELECT "t"."lead_id",
            "min"("t"."due_at") FILTER (WHERE ("t"."status_code" <> 'done'::"text")) AS "next_due_at",
            "count"(*) FILTER (WHERE ("t"."status_code" <> 'done'::"text")) AS "open_tasks",
            "count"(*) FILTER (WHERE (("t"."status_code" <> 'done'::"text") AND ("t"."due_at" < "now"()))) AS "overdue_tasks"
           FROM "public"."tasks" "t"
          WHERE ("t"."lead_id" IS NOT NULL)
          GROUP BY "t"."lead_id"
        )
 SELECT "l"."id" AS "lead_id",
    "l"."full_name",
    COALESCE("l"."lifecycle_state", "l"."status") AS "stage",
    "l"."assigned_to",
    "sp"."full_name" AS "counselor_name",
    "l"."source_code",
    "l"."created_at",
    "l"."first_response_due_at",
    "l"."first_responded_at",
    (("l"."first_responded_at" IS NULL) AND ("l"."first_response_due_at" IS NOT NULL) AND ("l"."first_response_due_at" < "now"())) AS "first_response_breached",
    GREATEST("lm"."at", "lc"."at", "la"."at", "l"."created_at") AS "last_touch_at",
    ("floor"((EXTRACT(epoch FROM ("now"() - GREATEST("lm"."at", "lc"."at", "la"."at", "l"."created_at"))) / (86400)::numeric)))::integer AS "days_since_touch",
    LEAST("nt"."next_due_at", "lc"."next_contact_at") AS "next_action_at",
    COALESCE("nt"."open_tasks", (0)::bigint) AS "open_tasks",
    COALESCE("nt"."overdue_tasks", (0)::bigint) AS "overdue_tasks",
    (("nt"."next_due_at" IS NULL) AND (("lc"."next_contact_at" IS NULL) OR ("lc"."next_contact_at" < "now"()))) AS "no_next_action",
    (LEAST("nt"."next_due_at", "lc"."next_contact_at") < "now"()) AS "next_action_overdue"
   FROM ((((("active_leads" "l"
     LEFT JOIN "public"."staff_profiles" "sp" ON (("sp"."id" = "l"."assigned_to")))
     LEFT JOIN "last_msg" "lm" ON (("lm"."lead_id" = "l"."id")))
     LEFT JOIN "last_call" "lc" ON (("lc"."lead_id" = "l"."id")))
     LEFT JOIN "last_activity" "la" ON (("la"."lead_id" = "l"."id")))
     LEFT JOIN "next_task" "nt" ON (("nt"."lead_id" = "l"."id")));


ALTER VIEW "public"."v_followup_integrity" OWNER TO "postgres";


COMMENT ON VIEW "public"."v_followup_integrity" IS 'Per-active-lead follow-up health: last touch, next action, SLA breaches. Read-only.';



CREATE OR REPLACE VIEW "public"."v_followup_integrity_by_staff" WITH ("security_invoker"='on') AS
 SELECT COALESCE("sp"."full_name", '— Unassigned —'::"text") AS "counselor_name",
    "v"."assigned_to",
    "count"(*) AS "active_leads",
    "count"(*) FILTER (WHERE "v"."no_next_action") AS "leads_no_next_action",
    "count"(*) FILTER (WHERE "v"."next_action_overdue") AS "leads_overdue",
    "count"(*) FILTER (WHERE "v"."first_response_breached") AS "first_response_breaches",
    "count"(*) FILTER (WHERE ("v"."days_since_touch" >= 3)) AS "untouched_3d",
    "count"(*) FILTER (WHERE ("v"."days_since_touch" >= 7)) AS "untouched_7d",
    "max"("v"."days_since_touch") AS "worst_untouched_days",
    "round"("avg"("v"."days_since_touch"), 1) AS "avg_days_since_touch"
   FROM ("public"."v_followup_integrity" "v"
     LEFT JOIN "public"."staff_profiles" "sp" ON (("sp"."id" = "v"."assigned_to")))
  GROUP BY "sp"."full_name", "v"."assigned_to"
  ORDER BY ("count"(*) FILTER (WHERE "v"."next_action_overdue")) DESC, ("count"(*) FILTER (WHERE "v"."no_next_action")) DESC;


ALTER VIEW "public"."v_followup_integrity_by_staff" OWNER TO "postgres";


COMMENT ON VIEW "public"."v_followup_integrity_by_staff" IS 'Follow-up discipline scoreboard per counselor. Read-only.';



CREATE OR REPLACE VIEW "public"."v_lead_deletions" AS
 SELECT "d"."id",
    "d"."deleted_at",
    COALESCE("d"."deleted_by_name", "s"."full_name", '(unknown)'::"text") AS "deleted_by_name",
    COALESCE("s"."role", '-'::"text") AS "deleted_by_role",
    "d"."full_name" AS "lead_name",
    "d"."phone",
    "d"."email",
    "d"."lead_status",
    "a"."full_name" AS "was_assigned_to",
    "d"."reason",
    ( SELECT COALESCE("sum"(("jsonb_each_text"."value")::integer), (0)::bigint) AS "coalesce"
           FROM "jsonb_each_text"("d"."dependents") "jsonb_each_text"("key", "value")) AS "records_destroyed",
    "d"."dependents",
    "d"."lead_id",
    "d"."lead_snapshot"
   FROM (("public"."lead_deletions" "d"
     LEFT JOIN "public"."staff_profiles" "s" ON (("s"."id" = "d"."deleted_by")))
     LEFT JOIN "public"."staff_profiles" "a" ON (("a"."id" = "d"."assigned_to")))
  ORDER BY "d"."deleted_at" DESC;


ALTER VIEW "public"."v_lead_deletions" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_lead_notes" WITH ("security_invoker"='true') AS
 SELECT DISTINCT "l"."id" AS "for_lead_id",
    "n"."id",
    "n"."lead_id",
    "n"."client_id",
    "n"."case_id",
    "n"."note_type",
    "n"."body",
    "n"."is_locked",
    "n"."locked_at",
    "n"."locked_by",
    "n"."unlocked_at",
    "n"."unlocked_by",
    "n"."created_by",
    "n"."created_at",
    "n"."updated_at",
    "n"."migrated_from"
   FROM ((("public"."leads" "l"
     LEFT JOIN "public"."clients" "cl" ON (("cl"."source_lead_id" = "l"."id")))
     LEFT JOIN "public"."cases" "ca" ON (("ca"."client_id" = "cl"."id")))
     JOIN "public"."entity_notes" "n" ON ((("n"."lead_id" = "l"."id") OR (("n"."client_id" IS NOT NULL) AND ("n"."client_id" = "cl"."id")) OR (("n"."case_id" IS NOT NULL) AND ("n"."case_id" = "ca"."id")))));


ALTER VIEW "public"."v_lead_notes" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_lead_overview" WITH ("security_invoker"='true') AS
 SELECT "l"."id" AS "lead_id",
    "l"."full_name",
    "l"."lifecycle_state",
    "l"."assigned_to",
    "cl"."id" AS "client_id",
    "s"."assessment_id",
    "s"."crs_score",
    "s"."province_scores",
    "s"."recommended_programs",
    "s"."current_occupation",
    "s"."noc_code",
    "s"."teer",
    "s"."canada_work_start_date",
    "s"."submitted_at" AS "assessment_submitted_at",
    ( SELECT "round"("avg"("r"."completion_pct")) AS "round"
           FROM "public"."questionnaire_responses" "r"
          WHERE ("r"."lead_id" = "l"."id")) AS "questionnaire_completion_pct",
    "l"."waiting_reason",
    "l"."waiting_end_date",
    "l"."waiting_review_notes",
    ( SELECT "json_agg"("json_build_object"('program', "n"."target_program_code", 'eligible_at', "n"."eligible_at", 'reason', "n"."reason", 'status', "n"."status", 'cap_at', "n"."cap_at")) AS "json_agg"
           FROM "public"."lead_nurture_targets" "n"
          WHERE ("n"."lead_id" = "l"."id")) AS "nurture_targets",
    ( SELECT "t"."title"
           FROM "public"."tasks" "t"
          WHERE (("t"."lead_id" = "l"."id") AND ("t"."status_code" <> ALL (ARRAY['done'::"text", 'cancelled'::"text", 'dismissed'::"text"])))
          ORDER BY "t"."due_at"
         LIMIT 1) AS "next_action",
    ( SELECT "min"("t"."due_at") AS "min"
           FROM "public"."tasks" "t"
          WHERE (("t"."lead_id" = "l"."id") AND ("t"."status_code" <> ALL (ARRAY['done'::"text", 'cancelled'::"text", 'dismissed'::"text"])))) AS "next_followup_at",
    ( SELECT "max"("t"."completed_at") AS "max"
           FROM "public"."tasks" "t"
          WHERE (("t"."lead_id" = "l"."id") AND ("t"."status_code" = 'done'::"text"))) AS "last_completed_task_at",
    ( SELECT "max"("e"."occurred_at") AS "max"
           FROM ("public"."communication_events" "e"
             JOIN "public"."conversations" "c" ON (("c"."id" = "e"."conversation_id")))
          WHERE (("c"."lead_id" = "l"."id") OR (("cl"."id" IS NOT NULL) AND ("c"."client_id" = "cl"."id")))) AS "last_contact_at",
    ( SELECT "json_agg"("json_build_object"('type', "x"."item_type", 'label', "x"."label", 'expires_on', "x"."expires_on")) AS "json_agg"
           FROM "public"."expiry_items" "x"
          WHERE (("cl"."id" IS NOT NULL) AND ("x"."client_id" = "cl"."id") AND "x"."is_active")) AS "expiring_items",
    ( SELECT "json_agg"("json_build_object"('application_type', "p"."target_application_type", 'status', "p"."status", 'trigger_date', "p"."trigger_date", 'expires_on', "p"."expires_on")) AS "json_agg"
           FROM "public"."prospective_applications" "p"
          WHERE ((("cl"."id" IS NOT NULL) AND ("p"."for_person_id" = "cl"."id")) OR (("cl"."family_unit_id" IS NOT NULL) AND ("p"."family_unit_id" = "cl"."family_unit_id")))) AS "future_applications"
   FROM (("public"."leads" "l"
     LEFT JOIN "public"."clients" "cl" ON (("cl"."source_lead_id" = "l"."id")))
     LEFT JOIN "public"."v_assessment_summary" "s" ON (("s"."lead_id" = "l"."id")));


ALTER VIEW "public"."v_lead_overview" OWNER TO "postgres";


COMMENT ON VIEW "public"."v_lead_overview" IS 'Lead Overview tab in five segments: assessment results · nurturing ·
   next action/follow-up/last contact · permit expiry · family & future apps.';



CREATE OR REPLACE VIEW "public"."v_lead_timeline" WITH ("security_invoker"='true') AS
 SELECT DISTINCT "l"."id" AS "for_lead_id",
    "t"."id",
    "t"."lead_id",
    "t"."case_id",
    "t"."client_id",
    "t"."event_type",
    "t"."title",
    "t"."body",
    "t"."metadata",
    "t"."actor_id",
    "t"."is_system",
    "t"."occurred_at",
    "t"."created_at"
   FROM ((("public"."leads" "l"
     LEFT JOIN "public"."clients" "cl" ON (("cl"."source_lead_id" = "l"."id")))
     LEFT JOIN "public"."cases" "ca" ON (("ca"."client_id" = "cl"."id")))
     JOIN "public"."activity_timeline" "t" ON ((("t"."lead_id" = "l"."id") OR (("t"."client_id" IS NOT NULL) AND ("t"."client_id" = "cl"."id")) OR (("t"."case_id" IS NOT NULL) AND ("t"."case_id" = "ca"."id")))));


ALTER VIEW "public"."v_lead_timeline" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_recent_chain_firings" AS
 SELECT "pa"."id" AS "prospective_id",
    "pa"."created_at",
    COALESCE("cr"."rule_code", 'MANUAL'::"text") AS "rule_code",
    "pa"."target_application_type",
    "pa"."trigger_date",
    "pa"."status",
    "pa"."assigned_counselor_id",
    "sp"."full_name" AS "counselor_name",
    "pa"."family_unit_id",
    "fu"."unit_name" AS "family_unit_name",
    "pa"."estimated_fee_cad"
   FROM ((("public"."prospective_applications" "pa"
     LEFT JOIN "public"."chain_rules" "cr" ON (("cr"."id" = "pa"."triggered_by_rule")))
     LEFT JOIN "public"."staff_profiles" "sp" ON (("sp"."id" = "pa"."assigned_counselor_id")))
     LEFT JOIN "public"."family_units" "fu" ON (("fu"."id" = "pa"."family_unit_id")))
  ORDER BY "pa"."created_at" DESC
 LIMIT 50;


ALTER VIEW "public"."v_recent_chain_firings" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_stage_events" WITH ("security_invoker"='true') AS
 SELECT "id",
    "occurred_at",
        CASE
            WHEN ("case_id" IS NOT NULL) THEN 'case'::"text"
            ELSE 'lead'::"text"
        END AS "scope",
    "lead_id",
    "case_id",
    "client_id",
    'stage_change'::"text" AS "event_type",
    "event_type" AS "source_event_type",
    "title",
    NULLIF(("metadata" ->> 'from'::"text"), ''::"text") AS "from_stage",
    NULLIF(("metadata" ->> 'to'::"text"), ''::"text") AS "to_stage",
    "actor_id",
    "is_system"
   FROM "public"."activity_timeline" "t"
  WHERE ("event_type" = ANY (ARRAY['stage_change'::"text", 'case_stage_change'::"text"]));


ALTER VIEW "public"."v_stage_events" OWNER TO "postgres";


COMMENT ON VIEW "public"."v_stage_events" IS 'Phase 2A: single normalised source for stage-change reporting. Unifies the legacy client vocabulary (case_stage_change) with the trigger vocabulary (stage_change) while preserving scope (case vs lead) and the original value in source_event_type. Query THIS, not activity_timeline, for stage analytics.';



CREATE OR REPLACE VIEW "public"."v_top_family_units" AS
 SELECT "id",
    "unit_name",
    "origin_country",
    "lifetime_revenue_cad",
    "expected_lifetime_revenue_cad",
    (( SELECT "count"(*) AS "count"
           FROM "public"."leads"
          WHERE ("leads"."family_unit_id" = "fu"."id")) + ( SELECT "count"(*) AS "count"
           FROM "public"."clients"
          WHERE ("clients"."family_unit_id" = "fu"."id"))) AS "member_count",
    ( SELECT "count"(*) AS "count"
           FROM "public"."prospective_applications"
          WHERE (("prospective_applications"."family_unit_id" = "fu"."id") AND ("prospective_applications"."status" = 'pending_counselor_action'::"text"))) AS "open_prospectives"
   FROM "public"."family_units" "fu"
  ORDER BY "expected_lifetime_revenue_cad" DESC NULLS LAST
 LIMIT 50;


ALTER VIEW "public"."v_top_family_units" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."visa_categories" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "code" "text" NOT NULL,
    "label" "text" NOT NULL,
    "sort_order" integer DEFAULT 100 NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."visa_categories" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."visa_sub_types" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "visa_type_id" "uuid",
    "code" "text" NOT NULL,
    "label" "text" NOT NULL,
    "processing_time_days" integer,
    "is_active" boolean DEFAULT true
);


ALTER TABLE "public"."visa_sub_types" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."wa_templates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" DEFAULT "public"."default_org_id"() NOT NULL,
    "name" "text" NOT NULL,
    "language" "text" DEFAULT 'en'::"text" NOT NULL,
    "body" "text" NOT NULL,
    "category" "text" DEFAULT 'utility'::"text" NOT NULL,
    "status" "text" DEFAULT 'approved'::"text" NOT NULL,
    CONSTRAINT "wa_templates_category_check" CHECK (("category" = ANY (ARRAY['utility'::"text", 'marketing'::"text", 'authentication'::"text"])))
);


ALTER TABLE "public"."wa_templates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."wa_webhook_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "received_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "signature_ok" boolean NOT NULL,
    "payload" "jsonb" NOT NULL
);


ALTER TABLE "public"."wa_webhook_events" OWNER TO "postgres";


ALTER TABLE ONLY "public"."audit_log" ATTACH PARTITION "public"."audit_log_2026_04" FOR VALUES FROM ('2026-04-01 00:00:00+00') TO ('2026-05-01 00:00:00+00');



ALTER TABLE ONLY "public"."audit_log" ATTACH PARTITION "public"."audit_log_2026_05" FOR VALUES FROM ('2026-05-01 00:00:00+00') TO ('2026-06-01 00:00:00+00');



ALTER TABLE ONLY "public"."audit_log" ATTACH PARTITION "public"."audit_log_2026_06" FOR VALUES FROM ('2026-06-01 00:00:00+00') TO ('2026-07-01 00:00:00+00');



ALTER TABLE ONLY "public"."audit_log" ATTACH PARTITION "public"."audit_log_2026_07" FOR VALUES FROM ('2026-07-01 00:00:00+00') TO ('2026-08-01 00:00:00+00');



ALTER TABLE ONLY "public"."audit_log" ATTACH PARTITION "public"."audit_log_2026_08" FOR VALUES FROM ('2026-08-01 00:00:00+00') TO ('2026-09-01 00:00:00+00');



ALTER TABLE ONLY "public"."audit_log" ATTACH PARTITION "public"."audit_log_2026_09" FOR VALUES FROM ('2026-09-01 00:00:00+00') TO ('2026-10-01 00:00:00+00');



ALTER TABLE ONLY "public"."audit_log" ATTACH PARTITION "public"."audit_log_2026_10" FOR VALUES FROM ('2026-10-01 00:00:00+00') TO ('2026-11-01 00:00:00+00');



ALTER TABLE ONLY "public"."audit_log" ATTACH PARTITION "public"."audit_log_2026_11" FOR VALUES FROM ('2026-11-01 00:00:00+00') TO ('2026-12-01 00:00:00+00');



ALTER TABLE ONLY "public"."audit_log" ATTACH PARTITION "public"."audit_log_2026_12" FOR VALUES FROM ('2026-12-01 00:00:00+00') TO ('2027-01-01 00:00:00+00');



ALTER TABLE ONLY "public"."audit_log" ATTACH PARTITION "public"."audit_log_2027_01" FOR VALUES FROM ('2027-01-01 00:00:00+00') TO ('2027-02-01 00:00:00+00');



ALTER TABLE ONLY "public"."audit_log" ATTACH PARTITION "public"."audit_log_2027_02" FOR VALUES FROM ('2027-02-01 00:00:00+00') TO ('2027-03-01 00:00:00+00');



ALTER TABLE ONLY "public"."audit_log" ATTACH PARTITION "public"."audit_log_default" DEFAULT;



ALTER TABLE ONLY "public"."activity_timeline"
    ADD CONSTRAINT "activity_timeline_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."agent_partners"
    ADD CONSTRAINT "agent_partners_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."api_keys"
    ADD CONSTRAINT "api_keys_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."app_settings"
    ADD CONSTRAINT "app_settings_pkey" PRIMARY KEY ("key");



ALTER TABLE ONLY "public"."applicant_relationships"
    ADD CONSTRAINT "applicant_relationships_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."appointments"
    ADD CONSTRAINT "appointments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."assessment_forms"
    ADD CONSTRAINT "assessment_forms_code_key" UNIQUE ("code");



ALTER TABLE ONLY "public"."assessment_forms"
    ADD CONSTRAINT "assessment_forms_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."assessments"
    ADD CONSTRAINT "assessments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."audit_log"
    ADD CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id", "occurred_at");



ALTER TABLE ONLY "public"."audit_log_2026_04"
    ADD CONSTRAINT "audit_log_2026_04_pkey" PRIMARY KEY ("id", "occurred_at");



ALTER TABLE ONLY "public"."audit_log_2026_05"
    ADD CONSTRAINT "audit_log_2026_05_pkey" PRIMARY KEY ("id", "occurred_at");



ALTER TABLE ONLY "public"."audit_log_2026_06"
    ADD CONSTRAINT "audit_log_2026_06_pkey" PRIMARY KEY ("id", "occurred_at");



ALTER TABLE ONLY "public"."audit_log_2026_07"
    ADD CONSTRAINT "audit_log_2026_07_pkey" PRIMARY KEY ("id", "occurred_at");



ALTER TABLE ONLY "public"."audit_log_2026_08"
    ADD CONSTRAINT "audit_log_2026_08_pkey" PRIMARY KEY ("id", "occurred_at");



ALTER TABLE ONLY "public"."audit_log_2026_09"
    ADD CONSTRAINT "audit_log_2026_09_pkey" PRIMARY KEY ("id", "occurred_at");



ALTER TABLE ONLY "public"."audit_log_2026_10"
    ADD CONSTRAINT "audit_log_2026_10_pkey" PRIMARY KEY ("id", "occurred_at");



ALTER TABLE ONLY "public"."audit_log_2026_11"
    ADD CONSTRAINT "audit_log_2026_11_pkey" PRIMARY KEY ("id", "occurred_at");



ALTER TABLE ONLY "public"."audit_log_2026_12"
    ADD CONSTRAINT "audit_log_2026_12_pkey" PRIMARY KEY ("id", "occurred_at");



ALTER TABLE ONLY "public"."audit_log_2027_01"
    ADD CONSTRAINT "audit_log_2027_01_pkey" PRIMARY KEY ("id", "occurred_at");



ALTER TABLE ONLY "public"."audit_log_2027_02"
    ADD CONSTRAINT "audit_log_2027_02_pkey" PRIMARY KEY ("id", "occurred_at");



ALTER TABLE ONLY "public"."audit_log_default"
    ADD CONSTRAINT "audit_log_default_pkey" PRIMARY KEY ("id", "occurred_at");



ALTER TABLE ONLY "public"."call_logs"
    ADD CONSTRAINT "call_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."case_applicants"
    ADD CONSTRAINT "case_applicants_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."case_documents"
    ADD CONSTRAINT "case_documents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."case_notes"
    ADD CONSTRAINT "case_notes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."case_requests"
    ADD CONSTRAINT "case_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."case_stage_history"
    ADD CONSTRAINT "case_stage_history_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."case_stages_ref"
    ADD CONSTRAINT "case_stages_ref_pkey" PRIMARY KEY ("code");



ALTER TABLE ONLY "public"."cases"
    ADD CONSTRAINT "cases_case_code_key" UNIQUE ("case_code");



ALTER TABLE ONLY "public"."cases"
    ADD CONSTRAINT "cases_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."chain_rules"
    ADD CONSTRAINT "chain_rules_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."chain_rules"
    ADD CONSTRAINT "chain_rules_rule_code_key" UNIQUE ("rule_code");



ALTER TABLE ONLY "public"."clients"
    ADD CONSTRAINT "clients_client_code_key" UNIQUE ("client_code");



ALTER TABLE ONLY "public"."clients"
    ADD CONSTRAINT "clients_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."comm_attachments"
    ADD CONSTRAINT "comm_attachments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."comm_audit_logs"
    ADD CONSTRAINT "comm_audit_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."comm_notifications"
    ADD CONSTRAINT "comm_notifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."commission_rules"
    ADD CONSTRAINT "commission_rules_code_key" UNIQUE ("code");



ALTER TABLE ONLY "public"."commission_rules"
    ADD CONSTRAINT "commission_rules_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."commissions"
    ADD CONSTRAINT "commissions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."communication_events"
    ADD CONSTRAINT "communication_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."communication_festivals"
    ADD CONSTRAINT "communication_festivals_pkey" PRIMARY KEY ("code");



ALTER TABLE ONLY "public"."contact_identities"
    ADD CONSTRAINT "contact_identities_org_id_channel_handle_norm_key" UNIQUE ("org_id", "channel", "handle_norm");



ALTER TABLE ONLY "public"."contact_identities"
    ADD CONSTRAINT "contact_identities_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."contact_reveal_log"
    ADD CONSTRAINT "contact_reveal_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."conversations"
    ADD CONSTRAINT "conversations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."countries"
    ADD CONSTRAINT "countries_pkey" PRIMARY KEY ("code");



ALTER TABLE ONLY "public"."document_checklist_rules"
    ADD CONSTRAINT "document_checklist_rules_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."document_checklist_rules"
    ADD CONSTRAINT "document_checklist_rules_visa_type_code_applicant_role_docu_key" UNIQUE ("visa_type_code", "applicant_role", "document_code");



ALTER TABLE ONLY "public"."document_checklists"
    ADD CONSTRAINT "document_checklists_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."entity_notes"
    ADD CONSTRAINT "entity_notes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."expiry_alert_rules"
    ADD CONSTRAINT "expiry_alert_rules_pkey" PRIMARY KEY ("item_type");



ALTER TABLE ONLY "public"."expiry_items"
    ADD CONSTRAINT "expiry_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."family_members"
    ADD CONSTRAINT "family_members_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."family_units"
    ADD CONSTRAINT "family_units_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."finance_entries"
    ADD CONSTRAINT "finance_entries_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."integrations_config"
    ADD CONSTRAINT "integrations_config_code_key" UNIQUE ("code");



ALTER TABLE ONLY "public"."integrations_config"
    ADD CONSTRAINT "integrations_config_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."invoices"
    ADD CONSTRAINT "invoices_invoice_number_key" UNIQUE ("invoice_number");



ALTER TABLE ONLY "public"."invoices"
    ADD CONSTRAINT "invoices_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ircc_emails"
    ADD CONSTRAINT "ircc_emails_gmail_message_id_key" UNIQUE ("gmail_message_id");



ALTER TABLE ONLY "public"."ircc_emails"
    ADD CONSTRAINT "ircc_emails_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."jobs"
    ADD CONSTRAINT "jobs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."lead_deletions"
    ADD CONSTRAINT "lead_deletions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."lead_nurture_targets"
    ADD CONSTRAINT "lead_nurture_targets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."lead_routing_rules"
    ADD CONSTRAINT "lead_routing_rules_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."lead_sources"
    ADD CONSTRAINT "lead_sources_pkey" PRIMARY KEY ("code");



ALTER TABLE ONLY "public"."leads"
    ADD CONSTRAINT "leads_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."office_holidays"
    ADD CONSTRAINT "office_holidays_pkey" PRIMARY KEY ("date");



ALTER TABLE ONLY "public"."office_hours_config"
    ADD CONSTRAINT "office_hours_config_pkey" PRIMARY KEY ("weekday");



ALTER TABLE ONLY "public"."office_settings"
    ADD CONSTRAINT "office_settings_pkey" PRIMARY KEY ("key");



ALTER TABLE ONLY "public"."orgs"
    ADD CONSTRAINT "orgs_code_key" UNIQUE ("code");



ALTER TABLE ONLY "public"."orgs"
    ADD CONSTRAINT "orgs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."outbound_messages"
    ADD CONSTRAINT "outbound_messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."program_eligibility_rules"
    ADD CONSTRAINT "program_eligibility_rules_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."program_eligibility_rules"
    ADD CONSTRAINT "program_eligibility_rules_visa_code_rule_code_key" UNIQUE ("visa_code", "rule_code");



ALTER TABLE ONLY "public"."prospective_applications"
    ADD CONSTRAINT "prospective_applications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."questionnaire_questions"
    ADD CONSTRAINT "questionnaire_questions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."questionnaire_questions"
    ADD CONSTRAINT "questionnaire_questions_section_id_field_code_key" UNIQUE ("section_id", "field_code");



ALTER TABLE ONLY "public"."questionnaire_response_items"
    ADD CONSTRAINT "questionnaire_response_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."questionnaire_response_items"
    ADD CONSTRAINT "questionnaire_response_items_response_id_question_id_key" UNIQUE ("response_id", "question_id");



ALTER TABLE ONLY "public"."questionnaire_responses"
    ADD CONSTRAINT "questionnaire_responses_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."questionnaire_sections"
    ADD CONSTRAINT "questionnaire_sections_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."questionnaire_sections"
    ADD CONSTRAINT "questionnaire_sections_template_id_code_key" UNIQUE ("template_id", "code");



ALTER TABLE ONLY "public"."questionnaire_templates"
    ADD CONSTRAINT "questionnaire_templates_code_key" UNIQUE ("code");



ALTER TABLE ONLY "public"."questionnaire_templates"
    ADD CONSTRAINT "questionnaire_templates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."referral_partners"
    ADD CONSTRAINT "referral_partners_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sla_rules"
    ADD CONSTRAINT "sla_rules_pkey" PRIMARY KEY ("code");



ALTER TABLE ONLY "public"."staff_profiles"
    ADD CONSTRAINT "staff_profiles_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."staff_profiles"
    ADD CONSTRAINT "staff_profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."step_conditions"
    ADD CONSTRAINT "step_conditions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."step_template_edits"
    ADD CONSTRAINT "step_template_edits_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."step_templates"
    ADD CONSTRAINT "step_templates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."step_templates"
    ADD CONSTRAINT "step_templates_visa_sub_type_id_step_code_version_key" UNIQUE ("visa_sub_type_id", "step_code", "version");



ALTER TABLE ONLY "public"."task_statuses_ref"
    ADD CONSTRAINT "task_statuses_ref_pkey" PRIMARY KEY ("code");



ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "tasks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."trigger_events"
    ADD CONSTRAINT "trigger_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."upsell_triggers"
    ADD CONSTRAINT "upsell_triggers_pkey" PRIMARY KEY ("code");



ALTER TABLE ONLY "public"."visa_categories"
    ADD CONSTRAINT "visa_categories_code_key" UNIQUE ("code");



ALTER TABLE ONLY "public"."visa_categories"
    ADD CONSTRAINT "visa_categories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."visa_sub_types"
    ADD CONSTRAINT "visa_sub_types_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."visa_sub_types"
    ADD CONSTRAINT "visa_sub_types_visa_type_id_code_key" UNIQUE ("visa_type_id", "code");



ALTER TABLE ONLY "public"."visa_types"
    ADD CONSTRAINT "visa_types_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."wa_templates"
    ADD CONSTRAINT "wa_templates_org_id_name_language_key" UNIQUE ("org_id", "name", "language");



ALTER TABLE ONLY "public"."wa_templates"
    ADD CONSTRAINT "wa_templates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."wa_webhook_events"
    ADD CONSTRAINT "wa_webhook_events_pkey" PRIMARY KEY ("id");



CREATE INDEX "applicant_relationships_from_idx" ON "public"."applicant_relationships" USING "btree" ("from_applicant_id");



CREATE INDEX "applicant_relationships_to_idx" ON "public"."applicant_relationships" USING "btree" ("to_applicant_id");



CREATE INDEX "idx_audit_actor" ON ONLY "public"."audit_log" USING "btree" ("actor_id", "occurred_at" DESC);



CREATE INDEX "audit_log_2026_04_actor_id_occurred_at_idx" ON "public"."audit_log_2026_04" USING "btree" ("actor_id", "occurred_at" DESC);



CREATE INDEX "idx_audit_entity" ON ONLY "public"."audit_log" USING "btree" ("entity_type", "entity_id", "occurred_at" DESC);



CREATE INDEX "audit_log_2026_04_entity_type_entity_id_occurred_at_idx" ON "public"."audit_log_2026_04" USING "btree" ("entity_type", "entity_id", "occurred_at" DESC);



CREATE INDEX "audit_log_2026_05_actor_id_occurred_at_idx" ON "public"."audit_log_2026_05" USING "btree" ("actor_id", "occurred_at" DESC);



CREATE INDEX "audit_log_2026_05_entity_type_entity_id_occurred_at_idx" ON "public"."audit_log_2026_05" USING "btree" ("entity_type", "entity_id", "occurred_at" DESC);



CREATE INDEX "audit_log_2026_06_actor_id_occurred_at_idx" ON "public"."audit_log_2026_06" USING "btree" ("actor_id", "occurred_at" DESC);



CREATE INDEX "audit_log_2026_06_entity_type_entity_id_occurred_at_idx" ON "public"."audit_log_2026_06" USING "btree" ("entity_type", "entity_id", "occurred_at" DESC);



CREATE INDEX "audit_log_2026_07_actor_id_occurred_at_idx" ON "public"."audit_log_2026_07" USING "btree" ("actor_id", "occurred_at" DESC);



CREATE INDEX "audit_log_2026_07_entity_type_entity_id_occurred_at_idx" ON "public"."audit_log_2026_07" USING "btree" ("entity_type", "entity_id", "occurred_at" DESC);



CREATE INDEX "audit_log_2026_08_actor_id_occurred_at_idx" ON "public"."audit_log_2026_08" USING "btree" ("actor_id", "occurred_at" DESC);



CREATE INDEX "audit_log_2026_08_entity_type_entity_id_occurred_at_idx" ON "public"."audit_log_2026_08" USING "btree" ("entity_type", "entity_id", "occurred_at" DESC);



CREATE INDEX "audit_log_2026_09_actor_id_occurred_at_idx" ON "public"."audit_log_2026_09" USING "btree" ("actor_id", "occurred_at" DESC);



CREATE INDEX "audit_log_2026_09_entity_type_entity_id_occurred_at_idx" ON "public"."audit_log_2026_09" USING "btree" ("entity_type", "entity_id", "occurred_at" DESC);



CREATE INDEX "audit_log_2026_10_actor_id_occurred_at_idx" ON "public"."audit_log_2026_10" USING "btree" ("actor_id", "occurred_at" DESC);



CREATE INDEX "audit_log_2026_10_entity_type_entity_id_occurred_at_idx" ON "public"."audit_log_2026_10" USING "btree" ("entity_type", "entity_id", "occurred_at" DESC);



CREATE INDEX "audit_log_2026_11_actor_id_occurred_at_idx" ON "public"."audit_log_2026_11" USING "btree" ("actor_id", "occurred_at" DESC);



CREATE INDEX "audit_log_2026_11_entity_type_entity_id_occurred_at_idx" ON "public"."audit_log_2026_11" USING "btree" ("entity_type", "entity_id", "occurred_at" DESC);



CREATE INDEX "audit_log_2026_12_actor_id_occurred_at_idx" ON "public"."audit_log_2026_12" USING "btree" ("actor_id", "occurred_at" DESC);



CREATE INDEX "audit_log_2026_12_entity_type_entity_id_occurred_at_idx" ON "public"."audit_log_2026_12" USING "btree" ("entity_type", "entity_id", "occurred_at" DESC);



CREATE INDEX "audit_log_2027_01_actor_id_occurred_at_idx" ON "public"."audit_log_2027_01" USING "btree" ("actor_id", "occurred_at" DESC);



CREATE INDEX "audit_log_2027_01_entity_type_entity_id_occurred_at_idx" ON "public"."audit_log_2027_01" USING "btree" ("entity_type", "entity_id", "occurred_at" DESC);



CREATE INDEX "audit_log_2027_02_actor_id_occurred_at_idx" ON "public"."audit_log_2027_02" USING "btree" ("actor_id", "occurred_at" DESC);



CREATE INDEX "audit_log_2027_02_entity_type_entity_id_occurred_at_idx" ON "public"."audit_log_2027_02" USING "btree" ("entity_type", "entity_id", "occurred_at" DESC);



CREATE INDEX "audit_log_default_actor_id_occurred_at_idx" ON "public"."audit_log_default" USING "btree" ("actor_id", "occurred_at" DESC);



CREATE INDEX "audit_log_default_entity_type_entity_id_occurred_at_idx" ON "public"."audit_log_default" USING "btree" ("entity_type", "entity_id", "occurred_at" DESC);



CREATE INDEX "case_applicants_case_idx" ON "public"."case_applicants" USING "btree" ("case_id");



CREATE INDEX "case_applicants_client_idx" ON "public"."case_applicants" USING "btree" ("client_id") WHERE ("client_id" IS NOT NULL);



CREATE UNIQUE INDEX "case_applicants_one_primary_per_case" ON "public"."case_applicants" USING "btree" ("case_id") WHERE ("is_primary" = true);



CREATE INDEX "case_notes_case_id_idx" ON "public"."case_notes" USING "btree" ("case_id", "created_at" DESC);



CREATE INDEX "document_checklist_rules_visa_idx" ON "public"."document_checklist_rules" USING "btree" ("visa_type_code") WHERE ("is_active" = true);



CREATE INDEX "idx_activity_timeline_case" ON "public"."activity_timeline" USING "btree" ("case_id", "occurred_at" DESC);



CREATE INDEX "idx_activity_timeline_client" ON "public"."activity_timeline" USING "btree" ("client_id", "occurred_at" DESC);



CREATE INDEX "idx_activity_timeline_lead" ON "public"."activity_timeline" USING "btree" ("lead_id", "occurred_at" DESC);



CREATE INDEX "idx_activity_timeline_occurred" ON "public"."activity_timeline" USING "btree" ("occurred_at" DESC);



CREATE INDEX "idx_api_keys_active" ON "public"."api_keys" USING "btree" ("key_prefix") WHERE ("revoked_at" IS NULL);



CREATE INDEX "idx_appointments_staff_date" ON "public"."appointments" USING "btree" ("staff_id", "scheduled_at");



CREATE INDEX "idx_assessments_lead" ON "public"."assessments" USING "btree" ("lead_id");



CREATE INDEX "idx_att_event" ON "public"."comm_attachments" USING "btree" ("event_id");



CREATE INDEX "idx_call_logs_case" ON "public"."call_logs" USING "btree" ("case_id", "called_at" DESC);



CREATE INDEX "idx_call_logs_lead" ON "public"."call_logs" USING "btree" ("lead_id", "called_at" DESC);



CREATE INDEX "idx_call_logs_staff" ON "public"."call_logs" USING "btree" ("staff_id", "called_at" DESC);



CREATE INDEX "idx_case_requests_case" ON "public"."case_requests" USING "btree" ("case_id");



CREATE INDEX "idx_case_requests_requester" ON "public"."case_requests" USING "btree" ("requested_by");



CREATE INDEX "idx_case_requests_status" ON "public"."case_requests" USING "btree" ("status");



CREATE INDEX "idx_cases_application_number" ON "public"."cases" USING "btree" ("application_number") WHERE ("application_number" IS NOT NULL);



CREATE INDEX "idx_cases_client" ON "public"."cases" USING "btree" ("client_id");



CREATE INDEX "idx_cases_manager_active" ON "public"."cases" USING "btree" ("case_manager_id") WHERE (("is_archived" = false) AND ("current_stage_code" <> ALL (ARRAY['approved'::"text", 'refused'::"text", 'withdrawn'::"text"])));



CREATE INDEX "idx_cases_risk" ON "public"."cases" USING "btree" ("risk_level") WHERE (("is_archived" = false) AND ("risk_level" = ANY (ARRAY['yellow'::"text", 'red'::"text"])));



CREATE INDEX "idx_cases_stage" ON "public"."cases" USING "btree" ("current_stage_code") WHERE ("is_archived" = false);



CREATE INDEX "idx_cases_target_sub" ON "public"."cases" USING "btree" ("target_submission_date") WHERE (("is_archived" = false) AND ("submitted_at" IS NULL));



CREATE INDEX "idx_cases_uci_number" ON "public"."cases" USING "btree" ("uci_number") WHERE ("uci_number" IS NOT NULL);



CREATE INDEX "idx_ce_conv_time" ON "public"."communication_events" USING "btree" ("conversation_id", "occurred_at" DESC);



CREATE INDEX "idx_ce_org_time" ON "public"."communication_events" USING "btree" ("org_id", "occurred_at" DESC);



CREATE INDEX "idx_checklist_sub" ON "public"."document_checklists" USING "btree" ("visa_sub_type_id");



CREATE INDEX "idx_ci_client" ON "public"."contact_identities" USING "btree" ("client_id");



CREATE INDEX "idx_ci_lead" ON "public"."contact_identities" USING "btree" ("lead_id");



CREATE INDEX "idx_ci_lookup" ON "public"."contact_identities" USING "btree" ("org_id", "handle_norm");



CREATE INDEX "idx_clients_active" ON "public"."clients" USING "btree" ("id") WHERE ("is_active" = true);



CREATE INDEX "idx_clients_birthday" ON "public"."clients" USING "btree" ("birthday_month_day") WHERE ("is_active" = true);



CREATE INDEX "idx_clients_email" ON "public"."clients" USING "btree" ("lower"("email"));



CREATE INDEX "idx_clients_name_trgm" ON "public"."clients" USING "gin" ("full_name" "public"."gin_trgm_ops");



CREATE INDEX "idx_clients_phone" ON "public"."clients" USING "btree" ("phone");



CREATE INDEX "idx_clients_portal_user" ON "public"."clients" USING "btree" ("portal_user_id");



CREATE INDEX "idx_commissions_case" ON "public"."commissions" USING "btree" ("case_id");



CREATE INDEX "idx_commissions_staff" ON "public"."commissions" USING "btree" ("staff_id", "status");



CREATE INDEX "idx_commissions_status" ON "public"."commissions" USING "btree" ("status") WHERE ("status" = ANY (ARRAY['accrued'::"text", 'approved'::"text"]));



CREATE INDEX "idx_conv_assignee" ON "public"."conversations" USING "btree" ("assigned_to", "status");



CREATE INDEX "idx_conv_client" ON "public"."conversations" USING "btree" ("client_id");



CREATE INDEX "idx_conv_lead" ON "public"."conversations" USING "btree" ("lead_id");



CREATE INDEX "idx_conv_triage" ON "public"."conversations" USING "btree" ("org_id", "status") WHERE ("status" = 'triage'::"text");



CREATE INDEX "idx_docs_case" ON "public"."case_documents" USING "btree" ("case_id") WHERE ("is_deleted" = false);



CREATE INDEX "idx_docs_expires" ON "public"."case_documents" USING "btree" ("expires_at") WHERE (("is_deleted" = false) AND ("expires_at" IS NOT NULL));



CREATE INDEX "idx_docs_status" ON "public"."case_documents" USING "btree" ("status") WHERE (("is_deleted" = false) AND ("status" = ANY (ARRAY['pending_review'::"text", 'needs_redo'::"text"])));



CREATE INDEX "idx_docs_type" ON "public"."case_documents" USING "btree" ("case_id", "document_type") WHERE ("is_deleted" = false);



CREATE INDEX "idx_entity_notes_case" ON "public"."entity_notes" USING "btree" ("case_id", "created_at" DESC);



CREATE INDEX "idx_entity_notes_client" ON "public"."entity_notes" USING "btree" ("client_id", "created_at" DESC);



CREATE INDEX "idx_entity_notes_lead" ON "public"."entity_notes" USING "btree" ("lead_id", "created_at" DESC);



CREATE INDEX "idx_expiry_items_due" ON "public"."expiry_items" USING "btree" ("expires_on") WHERE "is_active";



CREATE INDEX "idx_family_client" ON "public"."family_members" USING "btree" ("principal_client_id");



CREATE INDEX "idx_finance_entries_case" ON "public"."finance_entries" USING "btree" ("case_id", "incurred_on" DESC);



CREATE INDEX "idx_finance_entries_date" ON "public"."finance_entries" USING "btree" ("incurred_on" DESC);



CREATE INDEX "idx_finance_entries_type" ON "public"."finance_entries" USING "btree" ("entry_type");



CREATE INDEX "idx_invoices_case" ON "public"."invoices" USING "btree" ("case_id");



CREATE INDEX "idx_invoices_client" ON "public"."invoices" USING "btree" ("client_id");



CREATE INDEX "idx_invoices_due" ON "public"."invoices" USING "btree" ("due_date") WHERE ("status" = ANY (ARRAY['sent'::"text", 'partial'::"text"]));



CREATE INDEX "idx_invoices_status" ON "public"."invoices" USING "btree" ("status") WHERE ("status" = ANY (ARRAY['sent'::"text", 'partial'::"text", 'overdue'::"text"]));



CREATE INDEX "idx_ircc_emails_action" ON "public"."ircc_emails" USING "btree" ("action_due_at") WHERE (("requires_action" = true) AND ("processed_at" IS NULL));



CREATE INDEX "idx_ircc_emails_case" ON "public"."ircc_emails" USING "btree" ("matched_case_id");



CREATE INDEX "idx_ircc_emails_unprocessed" ON "public"."ircc_emails" USING "btree" ("received_at" DESC) WHERE ("processed_at" IS NULL);



CREATE INDEX "idx_jobs_claim" ON "public"."jobs" USING "btree" ("status", "run_after") WHERE ("status" = 'queued'::"text");



CREATE INDEX "idx_lead_del_lead" ON "public"."lead_deletions" USING "btree" ("lead_id");



CREATE INDEX "idx_lead_del_when" ON "public"."lead_deletions" USING "btree" ("deleted_at" DESC);



CREATE INDEX "idx_lead_del_who" ON "public"."lead_deletions" USING "btree" ("deleted_by");



CREATE INDEX "idx_lead_routing_rules_priority" ON "public"."lead_routing_rules" USING "btree" ("priority") WHERE ("is_active" = true);



CREATE INDEX "idx_leads_assigned" ON "public"."leads" USING "btree" ("assigned_to") WHERE ("status" <> ALL (ARRAY['converted'::"text", 'lost'::"text", 'duplicate'::"text"]));



CREATE INDEX "idx_leads_created" ON "public"."leads" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_leads_email" ON "public"."leads" USING "btree" ("lower"("email"));



CREATE INDEX "idx_leads_enquiry_client" ON "public"."leads" USING "btree" ("enquiry_client_id") WHERE ("enquiry_client_id" IS NOT NULL);



CREATE INDEX "idx_leads_lifecycle" ON "public"."leads" USING "btree" ("lifecycle_state") WHERE ("lifecycle_state" <> ALL (ARRAY['converted'::"text", 'declined'::"text"]));



CREATE INDEX "idx_leads_name_trgm" ON "public"."leads" USING "gin" ("full_name" "public"."gin_trgm_ops");



CREATE INDEX "idx_leads_phone" ON "public"."leads" USING "btree" ("phone");



CREATE INDEX "idx_leads_sla" ON "public"."leads" USING "btree" ("first_response_due_at") WHERE ("first_responded_at" IS NULL);



CREATE INDEX "idx_leads_status" ON "public"."leads" USING "btree" ("status") WHERE ("status" <> ALL (ARRAY['converted'::"text", 'lost'::"text", 'duplicate'::"text"]));



CREATE INDEX "idx_messages_case" ON "public"."messages" USING "btree" ("case_id", "sent_at" DESC) WHERE ("case_id" IS NOT NULL);



CREATE INDEX "idx_messages_channel" ON "public"."messages" USING "btree" ("channel", "sent_at" DESC);



CREATE INDEX "idx_messages_client" ON "public"."messages" USING "btree" ("client_id", "sent_at" DESC) WHERE ("client_id" IS NOT NULL);



CREATE INDEX "idx_messages_external" ON "public"."messages" USING "btree" ("external_message_id") WHERE ("external_message_id" IS NOT NULL);



CREATE INDEX "idx_messages_fulltext" ON "public"."messages" USING "gin" ("body_plain" "public"."gin_trgm_ops");



CREATE INDEX "idx_messages_is_template" ON "public"."messages" USING "btree" ("is_template") WHERE ("is_template" = true);



CREATE INDEX "idx_messages_lead" ON "public"."messages" USING "btree" ("lead_id", "sent_at" DESC) WHERE ("lead_id" IS NOT NULL);



CREATE INDEX "idx_messages_template_category" ON "public"."messages" USING "btree" ("template_category") WHERE ("is_template" = true);



CREATE INDEX "idx_messages_unread" ON "public"."messages" USING "btree" ("case_id") WHERE (("is_read" = false) AND ("direction" = 'inbound'::"text"));



CREATE INDEX "idx_mv_cases_at_risk_manager" ON "public"."mv_cases_at_risk" USING "btree" ("case_manager_id");



CREATE INDEX "idx_notif_staff" ON "public"."comm_notifications" USING "btree" ("staff_id", "read_at");



CREATE INDEX "idx_outbound_messages_case" ON "public"."outbound_messages" USING "btree" ("related_case_id");



CREATE INDEX "idx_outbound_messages_status_scheduled" ON "public"."outbound_messages" USING "btree" ("status", "scheduled_for") WHERE ("status" = 'queued'::"text");



CREATE INDEX "idx_payments_date" ON "public"."payments" USING "btree" ("paid_at" DESC);



CREATE INDEX "idx_payments_invoice" ON "public"."payments" USING "btree" ("invoice_id");



CREATE INDEX "idx_payments_status" ON "public"."payments" USING "btree" ("status");



CREATE INDEX "idx_reveal_staff_time" ON "public"."contact_reveal_log" USING "btree" ("staff_id", "revealed_at" DESC);



CREATE INDEX "idx_staff_profiles_role" ON "public"."staff_profiles" USING "btree" ("role") WHERE ("is_active" = true);



CREATE INDEX "idx_staff_profiles_specialties" ON "public"."staff_profiles" USING "gin" ("visa_specialties");



CREATE INDEX "idx_stage_history_case" ON "public"."case_stage_history" USING "btree" ("case_id", "changed_at" DESC);



CREATE INDEX "idx_step_edits_pending" ON "public"."step_template_edits" USING "btree" ("proposed_at" DESC) WHERE ("status" = 'pending'::"text");



CREATE INDEX "idx_steps_sub" ON "public"."step_templates" USING "btree" ("visa_sub_type_id", "sort_order") WHERE ("is_active" = true);



CREATE INDEX "idx_tasks_assigned" ON "public"."tasks" USING "btree" ("assigned_to", "due_date") WHERE ("status_code" <> ALL (ARRAY['done'::"text", 'cancelled'::"text"]));



CREATE INDEX "idx_tasks_case_open" ON "public"."tasks" USING "btree" ("case_id") WHERE ("status_code" <> ALL (ARRAY['done'::"text", 'cancelled'::"text"]));



CREATE INDEX "idx_tasks_due" ON "public"."tasks" USING "btree" ("due_at") WHERE ("status_code" <> ALL (ARRAY['done'::"text", 'cancelled'::"text"]));



CREATE INDEX "idx_tasks_key_open" ON "public"."tasks" USING "btree" ("lead_id", "case_id", "task_key") WHERE ("status_code" <> ALL (ARRAY['done'::"text", 'completed'::"text", 'cancelled'::"text", 'dismissed'::"text"]));



CREATE INDEX "idx_tasks_lead_open" ON "public"."tasks" USING "btree" ("lead_id") WHERE ("status_code" <> ALL (ARRAY['done'::"text", 'cancelled'::"text"]));



CREATE INDEX "idx_tasks_overdue" ON "public"."tasks" USING "btree" ("due_date") WHERE ("status_code" <> ALL (ARRAY['done'::"text", 'cancelled'::"text"]));



CREATE INDEX "idx_trigger_events_client" ON "public"."trigger_events" USING "btree" ("client_id");



CREATE INDEX "idx_trigger_events_pending" ON "public"."trigger_events" USING "btree" ("fired_at" DESC) WHERE ("outcome" = 'pending'::"text");



CREATE INDEX "idx_visa_sub_types_type" ON "public"."visa_sub_types" USING "btree" ("visa_type_id") WHERE ("is_active" = true);



CREATE INDEX "lead_nurture_targets_eligible_idx" ON "public"."lead_nurture_targets" USING "btree" ("eligible_at") WHERE ("status" = 'pending'::"text");



CREATE INDEX "lead_nurture_targets_lead_idx" ON "public"."lead_nurture_targets" USING "btree" ("lead_id");



CREATE INDEX "leads_lifecycle_state_idx" ON "public"."leads" USING "btree" ("lifecycle_state") WHERE ("lifecycle_state" = ANY (ARRAY['nurturing'::"text", 'eligible_now'::"text", 'qualified_nurture'::"text"]));



CREATE INDEX "questionnaire_questions_section_idx" ON "public"."questionnaire_questions" USING "btree" ("section_id", "sort_order");



CREATE INDEX "questionnaire_response_items_response_idx" ON "public"."questionnaire_response_items" USING "btree" ("response_id");



CREATE INDEX "questionnaire_responses_case_idx" ON "public"."questionnaire_responses" USING "btree" ("case_id") WHERE ("case_id" IS NOT NULL);



CREATE INDEX "questionnaire_responses_lead_idx" ON "public"."questionnaire_responses" USING "btree" ("lead_id") WHERE ("lead_id" IS NOT NULL);



CREATE INDEX "questionnaire_responses_template_idx" ON "public"."questionnaire_responses" USING "btree" ("template_id");



CREATE INDEX "questionnaire_sections_template_idx" ON "public"."questionnaire_sections" USING "btree" ("template_id", "sort_order");



CREATE INDEX "questionnaire_templates_visa_idx" ON "public"."questionnaire_templates" USING "btree" ("visa_type_code") WHERE ("visa_type_code" IS NOT NULL);



CREATE INDEX "tasks_kind_idx" ON "public"."tasks" USING "btree" ("kind");



CREATE UNIQUE INDEX "uq_assessment_forms_default" ON "public"."assessment_forms" USING "btree" ("is_default") WHERE "is_default";



CREATE UNIQUE INDEX "uq_ce_provider_msg" ON "public"."communication_events" USING "btree" ("provider_message_id") WHERE ("provider_message_id" IS NOT NULL);



CREATE UNIQUE INDEX "uq_clients_source_lead" ON "public"."clients" USING "btree" ("source_lead_id") WHERE ("source_lead_id" IS NOT NULL);



CREATE UNIQUE INDEX "uq_expiry_items_source_doc" ON "public"."expiry_items" USING "btree" ("source_document_id") WHERE ("source_document_id" IS NOT NULL);



CREATE UNIQUE INDEX "uq_messages_template_name" ON "public"."messages" USING "btree" ("template_name") WHERE "is_template";



CREATE UNIQUE INDEX "uq_trigger_events_case" ON "public"."trigger_events" USING "btree" ("trigger_code", "case_id") WHERE ("case_id" IS NOT NULL);



CREATE UNIQUE INDEX "uq_trigger_events_global" ON "public"."trigger_events" USING "btree" ("trigger_code") WHERE (("case_id" IS NULL) AND ("client_id" IS NULL));



CREATE UNIQUE INDEX "uq_trigger_events_lead" ON "public"."trigger_events" USING "btree" ("trigger_code", "client_id") WHERE (("case_id" IS NULL) AND ("client_id" IS NOT NULL));



CREATE UNIQUE INDEX "uq_visa_types_country_code" ON "public"."visa_types" USING "btree" ("destination_country", "code");



ALTER INDEX "public"."idx_audit_actor" ATTACH PARTITION "public"."audit_log_2026_04_actor_id_occurred_at_idx";



ALTER INDEX "public"."idx_audit_entity" ATTACH PARTITION "public"."audit_log_2026_04_entity_type_entity_id_occurred_at_idx";



ALTER INDEX "public"."audit_log_pkey" ATTACH PARTITION "public"."audit_log_2026_04_pkey";



ALTER INDEX "public"."idx_audit_actor" ATTACH PARTITION "public"."audit_log_2026_05_actor_id_occurred_at_idx";



ALTER INDEX "public"."idx_audit_entity" ATTACH PARTITION "public"."audit_log_2026_05_entity_type_entity_id_occurred_at_idx";



ALTER INDEX "public"."audit_log_pkey" ATTACH PARTITION "public"."audit_log_2026_05_pkey";



ALTER INDEX "public"."idx_audit_actor" ATTACH PARTITION "public"."audit_log_2026_06_actor_id_occurred_at_idx";



ALTER INDEX "public"."idx_audit_entity" ATTACH PARTITION "public"."audit_log_2026_06_entity_type_entity_id_occurred_at_idx";



ALTER INDEX "public"."audit_log_pkey" ATTACH PARTITION "public"."audit_log_2026_06_pkey";



ALTER INDEX "public"."idx_audit_actor" ATTACH PARTITION "public"."audit_log_2026_07_actor_id_occurred_at_idx";



ALTER INDEX "public"."idx_audit_entity" ATTACH PARTITION "public"."audit_log_2026_07_entity_type_entity_id_occurred_at_idx";



ALTER INDEX "public"."audit_log_pkey" ATTACH PARTITION "public"."audit_log_2026_07_pkey";



ALTER INDEX "public"."idx_audit_actor" ATTACH PARTITION "public"."audit_log_2026_08_actor_id_occurred_at_idx";



ALTER INDEX "public"."idx_audit_entity" ATTACH PARTITION "public"."audit_log_2026_08_entity_type_entity_id_occurred_at_idx";



ALTER INDEX "public"."audit_log_pkey" ATTACH PARTITION "public"."audit_log_2026_08_pkey";



ALTER INDEX "public"."idx_audit_actor" ATTACH PARTITION "public"."audit_log_2026_09_actor_id_occurred_at_idx";



ALTER INDEX "public"."idx_audit_entity" ATTACH PARTITION "public"."audit_log_2026_09_entity_type_entity_id_occurred_at_idx";



ALTER INDEX "public"."audit_log_pkey" ATTACH PARTITION "public"."audit_log_2026_09_pkey";



ALTER INDEX "public"."idx_audit_actor" ATTACH PARTITION "public"."audit_log_2026_10_actor_id_occurred_at_idx";



ALTER INDEX "public"."idx_audit_entity" ATTACH PARTITION "public"."audit_log_2026_10_entity_type_entity_id_occurred_at_idx";



ALTER INDEX "public"."audit_log_pkey" ATTACH PARTITION "public"."audit_log_2026_10_pkey";



ALTER INDEX "public"."idx_audit_actor" ATTACH PARTITION "public"."audit_log_2026_11_actor_id_occurred_at_idx";



ALTER INDEX "public"."idx_audit_entity" ATTACH PARTITION "public"."audit_log_2026_11_entity_type_entity_id_occurred_at_idx";



ALTER INDEX "public"."audit_log_pkey" ATTACH PARTITION "public"."audit_log_2026_11_pkey";



ALTER INDEX "public"."idx_audit_actor" ATTACH PARTITION "public"."audit_log_2026_12_actor_id_occurred_at_idx";



ALTER INDEX "public"."idx_audit_entity" ATTACH PARTITION "public"."audit_log_2026_12_entity_type_entity_id_occurred_at_idx";



ALTER INDEX "public"."audit_log_pkey" ATTACH PARTITION "public"."audit_log_2026_12_pkey";



ALTER INDEX "public"."idx_audit_actor" ATTACH PARTITION "public"."audit_log_2027_01_actor_id_occurred_at_idx";



ALTER INDEX "public"."idx_audit_entity" ATTACH PARTITION "public"."audit_log_2027_01_entity_type_entity_id_occurred_at_idx";



ALTER INDEX "public"."audit_log_pkey" ATTACH PARTITION "public"."audit_log_2027_01_pkey";



ALTER INDEX "public"."idx_audit_actor" ATTACH PARTITION "public"."audit_log_2027_02_actor_id_occurred_at_idx";



ALTER INDEX "public"."idx_audit_entity" ATTACH PARTITION "public"."audit_log_2027_02_entity_type_entity_id_occurred_at_idx";



ALTER INDEX "public"."audit_log_pkey" ATTACH PARTITION "public"."audit_log_2027_02_pkey";



ALTER INDEX "public"."idx_audit_actor" ATTACH PARTITION "public"."audit_log_default_actor_id_occurred_at_idx";



ALTER INDEX "public"."idx_audit_entity" ATTACH PARTITION "public"."audit_log_default_entity_type_entity_id_occurred_at_idx";



ALTER INDEX "public"."audit_log_pkey" ATTACH PARTITION "public"."audit_log_default_pkey";



CREATE OR REPLACE TRIGGER "app_settings_updated_at" BEFORE UPDATE ON "public"."app_settings" FOR EACH ROW EXECUTE FUNCTION "public"."app_settings_set_updated_at"();



CREATE OR REPLACE TRIGGER "case_applicants_updated_at" BEFORE UPDATE ON "public"."case_applicants" FOR EACH ROW EXECUTE FUNCTION "public"."case_applicants_set_updated_at"();



CREATE OR REPLACE TRIGGER "document_checklist_rules_updated_at" BEFORE UPDATE ON "public"."document_checklist_rules" FOR EACH ROW EXECUTE FUNCTION "public"."document_checklist_rules_set_updated_at"();



CREATE OR REPLACE TRIGGER "questionnaire_responses_updated_at" BEFORE UPDATE ON "public"."questionnaire_responses" FOR EACH ROW EXECUTE FUNCTION "public"."questionnaire_responses_set_updated_at"();



CREATE OR REPLACE TRIGGER "questionnaire_templates_updated_at" BEFORE UPDATE ON "public"."questionnaire_templates" FOR EACH ROW EXECUTE FUNCTION "public"."questionnaire_templates_set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_appointments_set_updated_at" BEFORE UPDATE ON "public"."appointments" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_assessment_submitted" AFTER INSERT ON "public"."assessments" FOR EACH ROW WHEN (("new"."status" = 'submitted'::"text")) EXECUTE FUNCTION "public"."fn_assessment_on_submit"();



CREATE OR REPLACE TRIGGER "trg_case_documents_updated" BEFORE UPDATE ON "public"."case_documents" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_cases_code" BEFORE INSERT ON "public"."cases" FOR EACH ROW EXECUTE FUNCTION "public"."gen_case_code"();



CREATE OR REPLACE TRIGGER "trg_cases_stage" BEFORE UPDATE OF "current_stage_code" ON "public"."cases" FOR EACH ROW EXECUTE FUNCTION "public"."log_stage_change"();



CREATE OR REPLACE TRIGGER "trg_cases_updated" BEFORE UPDATE ON "public"."cases" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_clients_code" BEFORE INSERT ON "public"."clients" FOR EACH ROW EXECUTE FUNCTION "public"."gen_client_code"();



CREATE OR REPLACE TRIGGER "trg_clients_updated" BEFORE UPDATE ON "public"."clients" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_countries_updated" BEFORE UPDATE ON "public"."countries" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_engine_case_created" AFTER INSERT ON "public"."cases" FOR EACH ROW EXECUTE FUNCTION "public"."fn_engine_on_case_created"();



CREATE OR REPLACE TRIGGER "trg_engine_chain_fire" AFTER UPDATE OF "current_stage_code" ON "public"."cases" FOR EACH ROW EXECUTE FUNCTION "public"."fn_engine_chain_fire"();



CREATE OR REPLACE TRIGGER "trg_engine_doc_expiry" AFTER INSERT OR UPDATE ON "public"."case_documents" FOR EACH ROW EXECUTE FUNCTION "public"."fn_engine_doc_expiry_sync"();



CREATE OR REPLACE TRIGGER "trg_engine_lead_created" AFTER INSERT ON "public"."leads" FOR EACH ROW EXECUTE FUNCTION "public"."fn_engine_on_lead_created"();



CREATE OR REPLACE TRIGGER "trg_engine_stage_change" AFTER UPDATE OF "current_stage_code" ON "public"."cases" FOR EACH ROW EXECUTE FUNCTION "public"."fn_engine_on_stage_change"();



CREATE OR REPLACE TRIGGER "trg_entity_notes_guard" BEFORE INSERT OR UPDATE ON "public"."entity_notes" FOR EACH ROW EXECUTE FUNCTION "public"."fn_entity_notes_guard"();



CREATE OR REPLACE TRIGGER "trg_entity_notes_timeline" AFTER INSERT OR UPDATE ON "public"."entity_notes" FOR EACH ROW EXECUTE FUNCTION "public"."fn_entity_notes_timeline"();



CREATE OR REPLACE TRIGGER "trg_family_members_updated" BEFORE UPDATE ON "public"."family_members" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_finance_entry_timeline" AFTER INSERT ON "public"."finance_entries" FOR EACH ROW EXECUTE FUNCTION "public"."fn_finance_entry_timeline"();



CREATE OR REPLACE TRIGGER "trg_integrations_config_updated_at" BEFORE UPDATE ON "public"."integrations_config" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_invoices_updated" BEFORE UPDATE ON "public"."invoices" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_lead_routing_rules_updated_at" BEFORE UPDATE ON "public"."lead_routing_rules" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_leads_guard_delete" BEFORE DELETE ON "public"."leads" FOR EACH ROW EXECUTE FUNCTION "public"."fn_leads_guard_delete"();



CREATE OR REPLACE TRIGGER "trg_leads_updated" BEFORE UPDATE ON "public"."leads" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_outbox_guard" BEFORE UPDATE ON "public"."outbound_messages" FOR EACH ROW EXECUTE FUNCTION "public"."fn_outbox_guard"();



CREATE OR REPLACE TRIGGER "trg_staff_block_self_escalation" BEFORE UPDATE ON "public"."staff_profiles" FOR EACH ROW EXECUTE FUNCTION "public"."staff_profiles_block_self_escalation"();



CREATE OR REPLACE TRIGGER "trg_staff_profiles_updated" BEFORE UPDATE ON "public"."staff_profiles" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_tasks_supersede" AFTER INSERT ON "public"."tasks" FOR EACH ROW EXECUTE FUNCTION "public"."fn_tasks_supersede"();



CREATE OR REPLACE TRIGGER "trg_tasks_updated" BEFORE UPDATE ON "public"."tasks" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_visa_categories_updated" BEFORE UPDATE ON "public"."visa_categories" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



ALTER TABLE ONLY "public"."activity_timeline"
    ADD CONSTRAINT "activity_timeline_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "public"."staff_profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."activity_timeline"
    ADD CONSTRAINT "activity_timeline_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."activity_timeline"
    ADD CONSTRAINT "activity_timeline_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."activity_timeline"
    ADD CONSTRAINT "activity_timeline_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."api_keys"
    ADD CONSTRAINT "api_keys_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."staff_profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."api_keys"
    ADD CONSTRAINT "api_keys_owner_staff_id_fkey" FOREIGN KEY ("owner_staff_id") REFERENCES "public"."staff_profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."app_settings"
    ADD CONSTRAINT "app_settings_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "public"."staff_profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."applicant_relationships"
    ADD CONSTRAINT "applicant_relationships_from_applicant_id_fkey" FOREIGN KEY ("from_applicant_id") REFERENCES "public"."case_applicants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."applicant_relationships"
    ADD CONSTRAINT "applicant_relationships_to_applicant_id_fkey" FOREIGN KEY ("to_applicant_id") REFERENCES "public"."case_applicants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."appointments"
    ADD CONSTRAINT "appointments_related_case_id_fkey" FOREIGN KEY ("related_case_id") REFERENCES "public"."cases"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."appointments"
    ADD CONSTRAINT "appointments_related_lead_id_fkey" FOREIGN KEY ("related_lead_id") REFERENCES "public"."leads"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."appointments"
    ADD CONSTRAINT "appointments_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "public"."staff_profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."assessments"
    ADD CONSTRAINT "assessments_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."assessments"
    ADD CONSTRAINT "assessments_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."assessments"
    ADD CONSTRAINT "assessments_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "public"."staff_profiles"("id");



ALTER TABLE ONLY "public"."call_logs"
    ADD CONSTRAINT "call_logs_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."call_logs"
    ADD CONSTRAINT "call_logs_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."call_logs"
    ADD CONSTRAINT "call_logs_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."call_logs"
    ADD CONSTRAINT "call_logs_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "public"."staff_profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."case_applicants"
    ADD CONSTRAINT "case_applicants_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."case_applicants"
    ADD CONSTRAINT "case_applicants_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."case_applicants"
    ADD CONSTRAINT "case_applicants_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."staff_profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."case_documents"
    ADD CONSTRAINT "case_documents_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."case_documents"
    ADD CONSTRAINT "case_documents_replaces_document_id_fkey" FOREIGN KEY ("replaces_document_id") REFERENCES "public"."case_documents"("id");



ALTER TABLE ONLY "public"."case_documents"
    ADD CONSTRAINT "case_documents_uploaded_by_client_id_fkey" FOREIGN KEY ("uploaded_by_client_id") REFERENCES "public"."clients"("id");



ALTER TABLE ONLY "public"."case_documents"
    ADD CONSTRAINT "case_documents_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "public"."staff_profiles"("id");



ALTER TABLE ONLY "public"."case_documents"
    ADD CONSTRAINT "case_documents_verified_by_fkey" FOREIGN KEY ("verified_by") REFERENCES "public"."staff_profiles"("id");



ALTER TABLE ONLY "public"."case_notes"
    ADD CONSTRAINT "case_notes_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "public"."staff_profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."case_notes"
    ADD CONSTRAINT "case_notes_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."case_requests"
    ADD CONSTRAINT "case_requests_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("id");



ALTER TABLE ONLY "public"."case_requests"
    ADD CONSTRAINT "case_requests_fulfilled_by_fkey" FOREIGN KEY ("fulfilled_by") REFERENCES "public"."staff_profiles"("id");



ALTER TABLE ONLY "public"."case_requests"
    ADD CONSTRAINT "case_requests_requested_by_fkey" FOREIGN KEY ("requested_by") REFERENCES "public"."staff_profiles"("id");



ALTER TABLE ONLY "public"."case_stage_history"
    ADD CONSTRAINT "case_stage_history_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."case_stage_history"
    ADD CONSTRAINT "case_stage_history_changed_by_fkey" FOREIGN KEY ("changed_by") REFERENCES "public"."staff_profiles"("id");



ALTER TABLE ONLY "public"."case_stage_history"
    ADD CONSTRAINT "case_stage_history_from_stage_code_fkey" FOREIGN KEY ("from_stage_code") REFERENCES "public"."case_stages_ref"("code");



ALTER TABLE ONLY "public"."case_stage_history"
    ADD CONSTRAINT "case_stage_history_to_stage_code_fkey" FOREIGN KEY ("to_stage_code") REFERENCES "public"."case_stages_ref"("code");



ALTER TABLE ONLY "public"."cases"
    ADD CONSTRAINT "cases_case_manager_id_fkey" FOREIGN KEY ("case_manager_id") REFERENCES "public"."staff_profiles"("id");



ALTER TABLE ONLY "public"."cases"
    ADD CONSTRAINT "cases_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."cases"
    ADD CONSTRAINT "cases_current_stage_code_fkey" FOREIGN KEY ("current_stage_code") REFERENCES "public"."case_stages_ref"("code");



ALTER TABLE ONLY "public"."cases"
    ADD CONSTRAINT "cases_senior_advisor_id_fkey" FOREIGN KEY ("senior_advisor_id") REFERENCES "public"."staff_profiles"("id");



ALTER TABLE ONLY "public"."cases"
    ADD CONSTRAINT "cases_visa_sub_type_id_fkey" FOREIGN KEY ("visa_sub_type_id") REFERENCES "public"."visa_sub_types"("id");



ALTER TABLE ONLY "public"."cases"
    ADD CONSTRAINT "cases_visa_type_id_fkey" FOREIGN KEY ("visa_type_id") REFERENCES "public"."visa_types"("id");



ALTER TABLE ONLY "public"."clients"
    ADD CONSTRAINT "clients_family_unit_id_fkey" FOREIGN KEY ("family_unit_id") REFERENCES "public"."family_units"("id");



ALTER TABLE ONLY "public"."clients"
    ADD CONSTRAINT "clients_portal_user_id_fkey" FOREIGN KEY ("portal_user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."clients"
    ADD CONSTRAINT "clients_source_lead_id_fkey" FOREIGN KEY ("source_lead_id") REFERENCES "public"."leads"("id");



ALTER TABLE ONLY "public"."comm_attachments"
    ADD CONSTRAINT "comm_attachments_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."communication_events"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."comm_attachments"
    ADD CONSTRAINT "comm_attachments_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id");



ALTER TABLE ONLY "public"."comm_audit_logs"
    ADD CONSTRAINT "comm_audit_logs_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id");



ALTER TABLE ONLY "public"."comm_notifications"
    ADD CONSTRAINT "comm_notifications_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."comm_notifications"
    ADD CONSTRAINT "comm_notifications_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id");



ALTER TABLE ONLY "public"."comm_notifications"
    ADD CONSTRAINT "comm_notifications_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "public"."staff_profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."commissions"
    ADD CONSTRAINT "commissions_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("id");



ALTER TABLE ONLY "public"."commissions"
    ADD CONSTRAINT "commissions_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id");



ALTER TABLE ONLY "public"."commissions"
    ADD CONSTRAINT "commissions_rule_code_fkey" FOREIGN KEY ("rule_code") REFERENCES "public"."commission_rules"("code");



ALTER TABLE ONLY "public"."commissions"
    ADD CONSTRAINT "commissions_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "public"."staff_profiles"("id");



ALTER TABLE ONLY "public"."communication_events"
    ADD CONSTRAINT "communication_events_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "public"."staff_profiles"("id");



ALTER TABLE ONLY "public"."communication_events"
    ADD CONSTRAINT "communication_events_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."communication_events"
    ADD CONSTRAINT "communication_events_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id");



ALTER TABLE ONLY "public"."contact_identities"
    ADD CONSTRAINT "contact_identities_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."contact_identities"
    ADD CONSTRAINT "contact_identities_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."contact_identities"
    ADD CONSTRAINT "contact_identities_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id");



ALTER TABLE ONLY "public"."contact_reveal_log"
    ADD CONSTRAINT "contact_reveal_log_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "public"."staff_profiles"("id");



ALTER TABLE ONLY "public"."conversations"
    ADD CONSTRAINT "conversations_assigned_to_fkey" FOREIGN KEY ("assigned_to") REFERENCES "public"."staff_profiles"("id");



ALTER TABLE ONLY "public"."conversations"
    ADD CONSTRAINT "conversations_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."conversations"
    ADD CONSTRAINT "conversations_contact_identity_id_fkey" FOREIGN KEY ("contact_identity_id") REFERENCES "public"."contact_identities"("id");



ALTER TABLE ONLY "public"."conversations"
    ADD CONSTRAINT "conversations_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."conversations"
    ADD CONSTRAINT "conversations_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id");



ALTER TABLE ONLY "public"."document_checklist_rules"
    ADD CONSTRAINT "document_checklist_rules_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."staff_profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."document_checklists"
    ADD CONSTRAINT "document_checklists_visa_sub_type_id_fkey" FOREIGN KEY ("visa_sub_type_id") REFERENCES "public"."visa_sub_types"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."entity_notes"
    ADD CONSTRAINT "entity_notes_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."entity_notes"
    ADD CONSTRAINT "entity_notes_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."entity_notes"
    ADD CONSTRAINT "entity_notes_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."staff_profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."entity_notes"
    ADD CONSTRAINT "entity_notes_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."entity_notes"
    ADD CONSTRAINT "entity_notes_locked_by_fkey" FOREIGN KEY ("locked_by") REFERENCES "public"."staff_profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."entity_notes"
    ADD CONSTRAINT "entity_notes_unlocked_by_fkey" FOREIGN KEY ("unlocked_by") REFERENCES "public"."staff_profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."expiry_items"
    ADD CONSTRAINT "expiry_items_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."expiry_items"
    ADD CONSTRAINT "expiry_items_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."expiry_items"
    ADD CONSTRAINT "expiry_items_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."staff_profiles"("id");



ALTER TABLE ONLY "public"."expiry_items"
    ADD CONSTRAINT "expiry_items_item_type_fkey" FOREIGN KEY ("item_type") REFERENCES "public"."expiry_alert_rules"("item_type");



ALTER TABLE ONLY "public"."family_members"
    ADD CONSTRAINT "family_members_principal_client_id_fkey" FOREIGN KEY ("principal_client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."finance_entries"
    ADD CONSTRAINT "finance_entries_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."finance_entries"
    ADD CONSTRAINT "finance_entries_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."finance_entries"
    ADD CONSTRAINT "finance_entries_recorded_by_fkey" FOREIGN KEY ("recorded_by") REFERENCES "public"."staff_profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."leads"
    ADD CONSTRAINT "fk_leads_converted_client" FOREIGN KEY ("converted_client_id") REFERENCES "public"."clients"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."invoices"
    ADD CONSTRAINT "invoices_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."invoices"
    ADD CONSTRAINT "invoices_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."ircc_emails"
    ADD CONSTRAINT "ircc_emails_matched_case_id_fkey" FOREIGN KEY ("matched_case_id") REFERENCES "public"."cases"("id");



ALTER TABLE ONLY "public"."ircc_emails"
    ADD CONSTRAINT "ircc_emails_processed_by_fkey" FOREIGN KEY ("processed_by") REFERENCES "public"."staff_profiles"("id");



ALTER TABLE ONLY "public"."jobs"
    ADD CONSTRAINT "jobs_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id");



ALTER TABLE ONLY "public"."lead_nurture_targets"
    ADD CONSTRAINT "lead_nurture_targets_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."staff_profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."lead_nurture_targets"
    ADD CONSTRAINT "lead_nurture_targets_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."lead_routing_rules"
    ADD CONSTRAINT "lead_routing_rules_assign_staff_id_fkey" FOREIGN KEY ("assign_staff_id") REFERENCES "public"."staff_profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."lead_routing_rules"
    ADD CONSTRAINT "lead_routing_rules_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."staff_profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."leads"
    ADD CONSTRAINT "leads_agent_partner_id_fkey" FOREIGN KEY ("agent_partner_id") REFERENCES "public"."agent_partners"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."leads"
    ADD CONSTRAINT "leads_assigned_to_fkey" FOREIGN KEY ("assigned_to") REFERENCES "public"."staff_profiles"("id");



ALTER TABLE ONLY "public"."leads"
    ADD CONSTRAINT "leads_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."staff_profiles"("id");



ALTER TABLE ONLY "public"."leads"
    ADD CONSTRAINT "leads_enquiry_client_id_fkey" FOREIGN KEY ("enquiry_client_id") REFERENCES "public"."clients"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."leads"
    ADD CONSTRAINT "leads_family_unit_id_fkey" FOREIGN KEY ("family_unit_id") REFERENCES "public"."family_units"("id");



ALTER TABLE ONLY "public"."leads"
    ADD CONSTRAINT "leads_interested_category_id_fkey" FOREIGN KEY ("interested_category_id") REFERENCES "public"."visa_categories"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."leads"
    ADD CONSTRAINT "leads_interested_visa_type_id_fkey" FOREIGN KEY ("interested_visa_type_id") REFERENCES "public"."visa_types"("id");



ALTER TABLE ONLY "public"."leads"
    ADD CONSTRAINT "leads_referral_partner_id_fkey" FOREIGN KEY ("referral_partner_id") REFERENCES "public"."referral_partners"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."leads"
    ADD CONSTRAINT "leads_source_code_fkey" FOREIGN KEY ("source_code") REFERENCES "public"."lead_sources"("code");



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_from_staff_id_fkey" FOREIGN KEY ("from_staff_id") REFERENCES "public"."staff_profiles"("id");



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "public"."messages"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."outbound_messages"
    ADD CONSTRAINT "outbound_messages_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."staff_profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."outbound_messages"
    ADD CONSTRAINT "outbound_messages_related_case_id_fkey" FOREIGN KEY ("related_case_id") REFERENCES "public"."cases"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."outbound_messages"
    ADD CONSTRAINT "outbound_messages_related_client_id_fkey" FOREIGN KEY ("related_client_id") REFERENCES "public"."clients"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."outbound_messages"
    ADD CONSTRAINT "outbound_messages_related_lead_id_fkey" FOREIGN KEY ("related_lead_id") REFERENCES "public"."leads"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."outbound_messages"
    ADD CONSTRAINT "outbound_messages_trigger_event_id_fkey" FOREIGN KEY ("trigger_event_id") REFERENCES "public"."trigger_events"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."prospective_applications"
    ADD CONSTRAINT "prospective_applications_assigned_counselor_id_fkey" FOREIGN KEY ("assigned_counselor_id") REFERENCES "public"."staff_profiles"("id");



ALTER TABLE ONLY "public"."prospective_applications"
    ADD CONSTRAINT "prospective_applications_family_unit_id_fkey" FOREIGN KEY ("family_unit_id") REFERENCES "public"."family_units"("id");



ALTER TABLE ONLY "public"."prospective_applications"
    ADD CONSTRAINT "prospective_applications_promoted_case_id_fkey" FOREIGN KEY ("promoted_case_id") REFERENCES "public"."cases"("id");



ALTER TABLE ONLY "public"."prospective_applications"
    ADD CONSTRAINT "prospective_applications_source_case_id_fkey" FOREIGN KEY ("source_case_id") REFERENCES "public"."cases"("id");



ALTER TABLE ONLY "public"."prospective_applications"
    ADD CONSTRAINT "prospective_applications_triggered_by_rule_fkey" FOREIGN KEY ("triggered_by_rule") REFERENCES "public"."chain_rules"("id");



ALTER TABLE ONLY "public"."questionnaire_questions"
    ADD CONSTRAINT "questionnaire_questions_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "public"."questionnaire_sections"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."questionnaire_response_items"
    ADD CONSTRAINT "questionnaire_response_items_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "public"."questionnaire_questions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."questionnaire_response_items"
    ADD CONSTRAINT "questionnaire_response_items_response_id_fkey" FOREIGN KEY ("response_id") REFERENCES "public"."questionnaire_responses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."questionnaire_responses"
    ADD CONSTRAINT "questionnaire_responses_applicant_id_fkey" FOREIGN KEY ("applicant_id") REFERENCES "public"."case_applicants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."questionnaire_responses"
    ADD CONSTRAINT "questionnaire_responses_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."questionnaire_responses"
    ADD CONSTRAINT "questionnaire_responses_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."questionnaire_responses"
    ADD CONSTRAINT "questionnaire_responses_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "public"."staff_profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."questionnaire_responses"
    ADD CONSTRAINT "questionnaire_responses_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "public"."questionnaire_templates"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."questionnaire_sections"
    ADD CONSTRAINT "questionnaire_sections_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "public"."questionnaire_templates"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."questionnaire_templates"
    ADD CONSTRAINT "questionnaire_templates_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."staff_profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."staff_profiles"
    ADD CONSTRAINT "staff_profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."step_conditions"
    ADD CONSTRAINT "step_conditions_alternate_step_id_fkey" FOREIGN KEY ("alternate_step_id") REFERENCES "public"."step_templates"("id");



ALTER TABLE ONLY "public"."step_conditions"
    ADD CONSTRAINT "step_conditions_step_template_id_fkey" FOREIGN KEY ("step_template_id") REFERENCES "public"."step_templates"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."step_template_edits"
    ADD CONSTRAINT "step_template_edits_proposed_by_fkey" FOREIGN KEY ("proposed_by") REFERENCES "public"."staff_profiles"("id");



ALTER TABLE ONLY "public"."step_template_edits"
    ADD CONSTRAINT "step_template_edits_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "public"."staff_profiles"("id");



ALTER TABLE ONLY "public"."step_template_edits"
    ADD CONSTRAINT "step_template_edits_step_template_id_fkey" FOREIGN KEY ("step_template_id") REFERENCES "public"."step_templates"("id");



ALTER TABLE ONLY "public"."step_templates"
    ADD CONSTRAINT "step_templates_sla_rule_code_fkey" FOREIGN KEY ("sla_rule_code") REFERENCES "public"."sla_rules"("code");



ALTER TABLE ONLY "public"."step_templates"
    ADD CONSTRAINT "step_templates_visa_sub_type_id_fkey" FOREIGN KEY ("visa_sub_type_id") REFERENCES "public"."visa_sub_types"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "tasks_assigned_to_fkey" FOREIGN KEY ("assigned_to") REFERENCES "public"."staff_profiles"("id");



ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "tasks_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "tasks_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."staff_profiles"("id");



ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "tasks_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "tasks_status_code_fkey" FOREIGN KEY ("status_code") REFERENCES "public"."task_statuses_ref"("code");



ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "tasks_superseded_by_fkey" FOREIGN KEY ("superseded_by") REFERENCES "public"."tasks"("id");



ALTER TABLE ONLY "public"."trigger_events"
    ADD CONSTRAINT "trigger_events_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("id");



ALTER TABLE ONLY "public"."trigger_events"
    ADD CONSTRAINT "trigger_events_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id");



ALTER TABLE ONLY "public"."trigger_events"
    ADD CONSTRAINT "trigger_events_created_task_id_fkey" FOREIGN KEY ("created_task_id") REFERENCES "public"."tasks"("id");



ALTER TABLE ONLY "public"."trigger_events"
    ADD CONSTRAINT "trigger_events_trigger_code_fkey" FOREIGN KEY ("trigger_code") REFERENCES "public"."upsell_triggers"("code");



ALTER TABLE ONLY "public"."visa_sub_types"
    ADD CONSTRAINT "visa_sub_types_visa_type_id_fkey" FOREIGN KEY ("visa_type_id") REFERENCES "public"."visa_types"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."visa_types"
    ADD CONSTRAINT "visa_types_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."visa_categories"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."wa_templates"
    ADD CONSTRAINT "wa_templates_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id");



CREATE POLICY "Authenticated can read chain_rules" ON "public"."chain_rules" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Staff can manage referral partners" ON "public"."referral_partners" TO "authenticated" USING ("public"."is_staff"()) WITH CHECK ("public"."is_staff"());



ALTER TABLE "public"."_backup_clients_20260712" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."_backup_clients_20260715" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."_backup_clients_dupes_20260712" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."_backup_clients_dupes_20260715" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."_backup_leads_20260712" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."_backup_leads_20260715" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."_backup_visa_types_20260717" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."_bak_assessment_forms_20260729" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."activity_timeline" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."agent_partners" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."api_keys" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."app_settings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."applicant_relationships" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."appointments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."assessment_forms" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."assessments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "assessments_staff" ON "public"."assessments" USING ("public"."fn_is_staff"()) WITH CHECK ("public"."fn_is_staff"());



CREATE POLICY "assessments_submit" ON "public"."assessments" FOR INSERT TO "authenticated", "anon" WITH CHECK (("status" = 'submitted'::"text"));



CREATE POLICY "att_select" ON "public"."comm_attachments" FOR SELECT TO "authenticated" USING (("public"."comm_can_use"() AND (EXISTS ( SELECT 1
   FROM ("public"."communication_events" "e"
     JOIN "public"."conversations" "c" ON (("c"."id" = "e"."conversation_id")))
  WHERE (("e"."id" = "comm_attachments"."event_id") AND (("c"."assigned_to" = "public"."comm_me"()) OR "public"."comm_is_manager"() OR "public"."comm_is_reception"()))))));



ALTER TABLE "public"."audit_log" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."audit_log_2026_04" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."audit_log_2026_05" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."audit_log_2026_06" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "cal_select" ON "public"."comm_audit_logs" FOR SELECT TO "authenticated" USING ("public"."comm_is_manager"());



ALTER TABLE "public"."call_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."case_applicants" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."case_documents" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."case_notes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "case_notes_delete" ON "public"."case_notes" FOR DELETE TO "authenticated" USING ((("author_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."staff_profiles"
  WHERE (("staff_profiles"."id" = "auth"."uid"()) AND ("staff_profiles"."role" = ANY (ARRAY['owner'::"text", 'admin'::"text"])))))));



CREATE POLICY "case_notes_insert" ON "public"."case_notes" FOR INSERT TO "authenticated" WITH CHECK (("author_id" = "auth"."uid"()));



CREATE POLICY "case_notes_update" ON "public"."case_notes" FOR UPDATE TO "authenticated" USING ((("author_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."staff_profiles"
  WHERE (("staff_profiles"."id" = "auth"."uid"()) AND ("staff_profiles"."role" = ANY (ARRAY['owner'::"text", 'admin'::"text"])))))));



ALTER TABLE "public"."case_requests" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."case_stage_history" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."case_stages_ref" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."cases" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "ce_select" ON "public"."communication_events" FOR SELECT TO "authenticated" USING (("public"."comm_can_use"() AND (EXISTS ( SELECT 1
   FROM "public"."conversations" "c"
  WHERE (("c"."id" = "communication_events"."conversation_id") AND (("c"."assigned_to" = "public"."comm_me"()) OR "public"."comm_is_manager"() OR "public"."comm_is_reception"()))))));



ALTER TABLE "public"."chain_rules" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "ci_select" ON "public"."contact_identities" FOR SELECT TO "authenticated" USING ((("org_id" = "public"."default_org_id"()) AND ("public"."comm_is_manager"() OR "public"."comm_is_reception"())));



CREATE POLICY "ci_write" ON "public"."contact_identities" TO "authenticated" USING ("public"."comm_is_manager"()) WITH CHECK ("public"."comm_is_manager"());



ALTER TABLE "public"."clients" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."comm_attachments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."comm_audit_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."comm_notifications" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."commission_rules" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."commissions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."communication_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."communication_festivals" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."contact_identities" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."contact_reveal_log" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "conv_assign" ON "public"."conversations" FOR UPDATE TO "authenticated" USING (("public"."comm_can_use"() AND (("assigned_to" = "public"."comm_me"()) OR "public"."comm_is_manager"() OR "public"."comm_is_reception"()))) WITH CHECK (("org_id" = "public"."default_org_id"()));



CREATE POLICY "conv_select" ON "public"."conversations" FOR SELECT TO "authenticated" USING ((("org_id" = "public"."default_org_id"()) AND "public"."comm_can_use"() AND (("assigned_to" = "public"."comm_me"()) OR "public"."comm_is_manager"() OR "public"."comm_is_reception"())));



ALTER TABLE "public"."conversations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."countries" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."document_checklist_rules" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."document_checklists" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "elig_rules_read" ON "public"."program_eligibility_rules" FOR SELECT USING (true);



CREATE POLICY "elig_rules_write" ON "public"."program_eligibility_rules" USING ("public"."fn_is_owner_admin"()) WITH CHECK ("public"."fn_is_owner_admin"());



ALTER TABLE "public"."entity_notes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."expiry_alert_rules" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."expiry_items" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "expiry_items_staff" ON "public"."expiry_items" USING ("public"."fn_is_staff"()) WITH CHECK ("public"."fn_is_staff"());



CREATE POLICY "expiry_rules_read" ON "public"."expiry_alert_rules" FOR SELECT USING ("public"."fn_is_staff"());



CREATE POLICY "expiry_rules_write" ON "public"."expiry_alert_rules" USING ("public"."fn_is_owner_admin"()) WITH CHECK ("public"."fn_is_owner_admin"());



ALTER TABLE "public"."family_members" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."family_units" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."finance_entries" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."integrations_config" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."invoices" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "invoices_portal" ON "public"."invoices" FOR SELECT TO "authenticated" USING (("client_id" IN ( SELECT "c"."id"
   FROM "public"."clients" "c"
  WHERE ("lower"("c"."email") = "lower"(COALESCE(("auth"."jwt"() ->> 'email'::"text"), ''::"text"))))));



ALTER TABLE "public"."ircc_emails" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."jobs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "lead_del_select" ON "public"."lead_deletions" FOR SELECT TO "authenticated" USING ("public"."fn_can_delete_leads"());



ALTER TABLE "public"."lead_deletions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."lead_nurture_targets" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."lead_routing_rules" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."lead_sources" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."leads" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."messages" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "notif_own" ON "public"."comm_notifications" FOR SELECT TO "authenticated" USING (("staff_id" = "public"."comm_me"()));



CREATE POLICY "notif_read" ON "public"."comm_notifications" FOR UPDATE TO "authenticated" USING (("staff_id" = "public"."comm_me"())) WITH CHECK (("staff_id" = "public"."comm_me"()));



ALTER TABLE "public"."office_holidays" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."office_hours_config" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."office_settings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."orgs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "orgs_select" ON "public"."orgs" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."outbound_messages" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "p_aforms_admin_write" ON "public"."assessment_forms" TO "authenticated" USING ("public"."fn_is_owner_admin"()) WITH CHECK ("public"."fn_is_owner_admin"());



CREATE POLICY "p_aforms_public_read" ON "public"."assessment_forms" FOR SELECT USING (("is_active" = true));



CREATE POLICY "p_aforms_staff_read" ON "public"."assessment_forms" FOR SELECT TO "authenticated" USING ("public"."fn_is_staff"());



CREATE POLICY "p_api_keys_owner_admin_all" ON "public"."api_keys" TO "authenticated" USING ("public"."auth_is_owner_or_admin"()) WITH CHECK ("public"."auth_is_owner_or_admin"());



CREATE POLICY "p_app_settings_staff_read" ON "public"."app_settings" FOR SELECT TO "authenticated" USING ("public"."fn_is_staff"());



CREATE POLICY "p_app_settings_write" ON "public"."app_settings" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."staff_profiles" "sp"
  WHERE (("sp"."id" = "auth"."uid"()) AND ("sp"."role" = ANY (ARRAY['owner'::"text", 'admin'::"text"])) AND ("sp"."is_active" = true))))) WITH CHECK (true);



CREATE POLICY "p_applicant_relationships_select" ON "public"."applicant_relationships" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."case_applicants" "ca"
     JOIN "public"."cases" "c" ON (("c"."id" = "ca"."case_id")))
  WHERE (("ca"."id" = "applicant_relationships"."from_applicant_id") AND ((EXISTS ( SELECT 1
           FROM "public"."staff_profiles" "sp"
          WHERE (("sp"."id" = "auth"."uid"()) AND ("sp"."role" = ANY (ARRAY['owner'::"text", 'admin'::"text", 'senior_advisor'::"text", 'senior_counsellor'::"text", 'visa_expert'::"text", 'case_manager'::"text", 'filer_manager'::"text", 'filer'::"text", 'document_specialist'::"text"])) AND ("sp"."is_active" = true)))) OR ("c"."case_manager_id" = "auth"."uid"()))))));



CREATE POLICY "p_applicant_relationships_write" ON "public"."applicant_relationships" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."case_applicants" "ca"
     JOIN "public"."cases" "c" ON (("c"."id" = "ca"."case_id")))
  WHERE (("ca"."id" = "applicant_relationships"."from_applicant_id") AND ((EXISTS ( SELECT 1
           FROM "public"."staff_profiles" "sp"
          WHERE (("sp"."id" = "auth"."uid"()) AND ("sp"."role" = ANY (ARRAY['owner'::"text", 'admin'::"text", 'senior_advisor'::"text", 'senior_counsellor'::"text", 'visa_expert'::"text", 'case_manager'::"text", 'filer_manager'::"text", 'filer'::"text", 'document_specialist'::"text"])) AND ("sp"."is_active" = true)))) OR ("c"."case_manager_id" = "auth"."uid"())))))) WITH CHECK (true);



CREATE POLICY "p_appointments_admin_all" ON "public"."appointments" TO "authenticated" USING ("public"."auth_is_owner_or_admin"()) WITH CHECK ("public"."auth_is_owner_or_admin"());



CREATE POLICY "p_appointments_staff_own" ON "public"."appointments" TO "authenticated" USING (("staff_id" = "auth"."uid"())) WITH CHECK (("staff_id" = "auth"."uid"()));



CREATE POLICY "p_audit_staff_insert" ON "public"."audit_log" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_staff"());



CREATE POLICY "p_audit_staff_read" ON "public"."audit_log" FOR SELECT TO "authenticated" USING ("public"."is_staff"());



CREATE POLICY "p_call_logs_owner_admin_all" ON "public"."call_logs" TO "authenticated" USING ("public"."auth_is_owner_or_admin"()) WITH CHECK ("public"."auth_is_owner_or_admin"());



CREATE POLICY "p_call_logs_staff_insert" ON "public"."call_logs" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_staff"());



CREATE POLICY "p_call_logs_staff_read" ON "public"."call_logs" FOR SELECT TO "authenticated" USING ("public"."is_staff"());



CREATE POLICY "p_case_applicants_select" ON "public"."case_applicants" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."cases" "c"
  WHERE (("c"."id" = "case_applicants"."case_id") AND ((EXISTS ( SELECT 1
           FROM "public"."staff_profiles" "sp"
          WHERE (("sp"."id" = "auth"."uid"()) AND ("sp"."role" = ANY (ARRAY['owner'::"text", 'admin'::"text", 'senior_advisor'::"text", 'senior_counsellor'::"text", 'visa_expert'::"text", 'case_manager'::"text", 'filer_manager'::"text", 'filer'::"text", 'document_specialist'::"text"])) AND ("sp"."is_active" = true)))) OR ("c"."case_manager_id" = "auth"."uid"()))))));



CREATE POLICY "p_case_applicants_write" ON "public"."case_applicants" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."cases" "c"
  WHERE (("c"."id" = "case_applicants"."case_id") AND ((EXISTS ( SELECT 1
           FROM "public"."staff_profiles" "sp"
          WHERE (("sp"."id" = "auth"."uid"()) AND ("sp"."role" = ANY (ARRAY['owner'::"text", 'admin'::"text", 'senior_advisor'::"text", 'senior_counsellor'::"text", 'visa_expert'::"text", 'case_manager'::"text", 'filer_manager'::"text", 'filer'::"text", 'document_specialist'::"text"])) AND ("sp"."is_active" = true)))) OR ("c"."case_manager_id" = "auth"."uid"())))))) WITH CHECK (true);



CREATE POLICY "p_case_documents_portal_self" ON "public"."case_documents" FOR SELECT TO "authenticated" USING (("case_id" IN ( SELECT "c"."id"
   FROM ("public"."cases" "c"
     JOIN "public"."clients" "cl" ON (("cl"."id" = "c"."client_id")))
  WHERE ("cl"."email" = "auth"."email"()))));



CREATE POLICY "p_case_documents_portal_upload" ON "public"."case_documents" FOR UPDATE TO "authenticated" USING ((("case_id" IN ( SELECT "c"."id"
   FROM ("public"."cases" "c"
     JOIN "public"."clients" "cl" ON (("cl"."id" = "c"."client_id")))
  WHERE ("cl"."email" = "auth"."email"()))) AND ("status" = 'pending_upload'::"text"))) WITH CHECK ((("case_id" IN ( SELECT "c"."id"
   FROM ("public"."cases" "c"
     JOIN "public"."clients" "cl" ON (("cl"."id" = "c"."client_id")))
  WHERE ("cl"."email" = "auth"."email"()))) AND ("status" = 'pending'::"text")));



CREATE POLICY "p_case_notes_staff_read" ON "public"."case_notes" FOR SELECT TO "authenticated" USING ("public"."fn_is_staff"());



CREATE POLICY "p_case_requests_insert_own" ON "public"."case_requests" FOR INSERT TO "authenticated" WITH CHECK ((("requested_by" = "auth"."uid"()) AND "public"."fn_is_staff"()));



CREATE POLICY "p_case_requests_manage" ON "public"."case_requests" FOR UPDATE TO "authenticated" USING (("public"."fn_is_owner_admin"() OR "public"."fn_is_case_mgr"())) WITH CHECK (("public"."fn_is_owner_admin"() OR "public"."fn_is_case_mgr"()));



CREATE POLICY "p_case_requests_read_own" ON "public"."case_requests" FOR SELECT TO "authenticated" USING ((("requested_by" = "auth"."uid"()) OR "public"."fn_is_owner_admin"() OR "public"."fn_is_case_mgr"()));



CREATE POLICY "p_case_stages_public_read" ON "public"."case_stages_ref" FOR SELECT TO "authenticated", "anon" USING (true);



CREATE POLICY "p_case_stages_staff_rw" ON "public"."case_stages_ref" TO "authenticated" USING ("public"."is_staff"()) WITH CHECK ("public"."is_staff"());



CREATE POLICY "p_cases_client_read" ON "public"."cases" FOR SELECT USING (("client_id" IN ( SELECT "clients"."id"
   FROM "public"."clients"
  WHERE ("clients"."portal_user_id" = "auth"."uid"()))));



CREATE POLICY "p_cases_portal_self" ON "public"."cases" FOR SELECT TO "authenticated" USING (("client_id" IN ( SELECT "clients"."id"
   FROM "public"."clients"
  WHERE ("clients"."email" = "auth"."email"()))));



CREATE POLICY "p_cases_team_rw" ON "public"."cases" TO "authenticated" USING ("public"."fn_can_case"()) WITH CHECK ("public"."fn_can_case"());



CREATE POLICY "p_clients_portal_read" ON "public"."clients" FOR SELECT USING (("portal_user_id" = "auth"."uid"()));



CREATE POLICY "p_clients_portal_self" ON "public"."clients" FOR SELECT TO "authenticated" USING (("email" = "auth"."email"()));



CREATE POLICY "p_clients_read_team" ON "public"."clients" FOR SELECT TO "authenticated" USING (("public"."fn_is_filing_ft"() OR "public"."fn_is_intake"()));



CREATE POLICY "p_clients_rw" ON "public"."clients" TO "authenticated" USING (("public"."fn_is_owner_admin"() OR "public"."fn_is_case_mgr"())) WITH CHECK (("public"."fn_is_owner_admin"() OR "public"."fn_is_case_mgr"()));



CREATE POLICY "p_commission_rules_staff" ON "public"."commission_rules" TO "authenticated" USING ("public"."is_staff"()) WITH CHECK ("public"."is_staff"());



CREATE POLICY "p_commissions_staff_rw" ON "public"."commissions" TO "authenticated" USING ("public"."is_staff"()) WITH CHECK ("public"."is_staff"());



CREATE POLICY "p_countries_admin_write" ON "public"."countries" TO "authenticated" USING ("public"."auth_is_owner_or_admin"()) WITH CHECK ("public"."auth_is_owner_or_admin"());



CREATE POLICY "p_countries_staff_read" ON "public"."countries" FOR SELECT TO "authenticated" USING ("public"."is_staff"());



CREATE POLICY "p_doc_checklist_rules_read" ON "public"."document_checklist_rules" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "p_doc_checklist_rules_write" ON "public"."document_checklist_rules" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."staff_profiles" "sp"
  WHERE (("sp"."id" = "auth"."uid"()) AND ("sp"."role" = ANY (ARRAY['owner'::"text", 'admin'::"text", 'senior_advisor'::"text", 'senior_counsellor'::"text"])) AND ("sp"."is_active" = true))))) WITH CHECK (true);



CREATE POLICY "p_docs_client_read" ON "public"."case_documents" FOR SELECT USING ((("case_id" IN ( SELECT "c"."id"
   FROM ("public"."cases" "c"
     JOIN "public"."clients" "cl" ON (("cl"."id" = "c"."client_id")))
  WHERE ("cl"."portal_user_id" = "auth"."uid"()))) AND ("is_deleted" = false)));



CREATE POLICY "p_docs_staff_rw" ON "public"."case_documents" TO "authenticated" USING ("public"."fn_can_case"()) WITH CHECK ("public"."fn_can_case"());



CREATE POLICY "p_family_read_filing" ON "public"."family_members" FOR SELECT TO "authenticated" USING ("public"."fn_is_filing_ft"());



CREATE POLICY "p_family_rw" ON "public"."family_members" TO "authenticated" USING (("public"."fn_is_owner_admin"() OR "public"."fn_is_case_mgr"())) WITH CHECK (("public"."fn_is_owner_admin"() OR "public"."fn_is_case_mgr"()));



CREATE POLICY "p_family_units_staff_insert" ON "public"."family_units" FOR INSERT TO "authenticated" WITH CHECK ("public"."fn_is_staff"());



CREATE POLICY "p_family_units_staff_read" ON "public"."family_units" FOR SELECT TO "authenticated" USING ("public"."fn_is_staff"());



CREATE POLICY "p_family_units_staff_update" ON "public"."family_units" FOR UPDATE TO "authenticated" USING ("public"."fn_is_staff"()) WITH CHECK ("public"."fn_is_staff"());



CREATE POLICY "p_finance_entries_all" ON "public"."finance_entries" TO "authenticated" USING ("public"."fn_is_finance"()) WITH CHECK ("public"."fn_is_finance"());



CREATE POLICY "p_integrations_owner_admin_all" ON "public"."integrations_config" TO "authenticated" USING ("public"."auth_is_owner_or_admin"()) WITH CHECK ("public"."auth_is_owner_or_admin"());



CREATE POLICY "p_integrations_staff_read" ON "public"."integrations_config" FOR SELECT TO "authenticated" USING ("public"."is_staff"());



CREATE POLICY "p_invoices_client_read" ON "public"."invoices" FOR SELECT USING (("client_id" IN ( SELECT "clients"."id"
   FROM "public"."clients"
  WHERE ("clients"."portal_user_id" = "auth"."uid"()))));



CREATE POLICY "p_invoices_finance" ON "public"."invoices" TO "authenticated" USING ("public"."fn_is_finance"()) WITH CHECK ("public"."fn_is_finance"());



CREATE POLICY "p_ircc_emails_staff" ON "public"."ircc_emails" TO "authenticated" USING ("public"."is_staff"()) WITH CHECK ("public"."is_staff"());



CREATE POLICY "p_lead_nurture_targets_select" ON "public"."lead_nurture_targets" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."leads" "l"
  WHERE (("l"."id" = "lead_nurture_targets"."lead_id") AND ((EXISTS ( SELECT 1
           FROM "public"."staff_profiles" "sp"
          WHERE (("sp"."id" = "auth"."uid"()) AND ("sp"."role" = ANY (ARRAY['owner'::"text", 'admin'::"text", 'senior_advisor'::"text", 'senior_counsellor'::"text"])) AND ("sp"."is_active" = true)))) OR ("l"."assigned_to" = "auth"."uid"()) OR ("l"."created_by" = "auth"."uid"()))))));



CREATE POLICY "p_lead_nurture_targets_write" ON "public"."lead_nurture_targets" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."leads" "l"
  WHERE (("l"."id" = "lead_nurture_targets"."lead_id") AND ((EXISTS ( SELECT 1
           FROM "public"."staff_profiles" "sp"
          WHERE (("sp"."id" = "auth"."uid"()) AND ("sp"."role" = ANY (ARRAY['owner'::"text", 'admin'::"text", 'senior_advisor'::"text", 'senior_counsellor'::"text"])) AND ("sp"."is_active" = true)))) OR ("l"."assigned_to" = "auth"."uid"()) OR ("l"."created_by" = "auth"."uid"())))))) WITH CHECK (true);



CREATE POLICY "p_lead_routing_owner_admin_all" ON "public"."lead_routing_rules" TO "authenticated" USING ("public"."auth_is_owner_or_admin"()) WITH CHECK ("public"."auth_is_owner_or_admin"());



CREATE POLICY "p_lead_routing_staff_read" ON "public"."lead_routing_rules" FOR SELECT TO "authenticated" USING ("public"."is_staff"());



CREATE POLICY "p_lead_sources_public_read" ON "public"."lead_sources" FOR SELECT TO "authenticated", "anon" USING (("is_active" = true));



CREATE POLICY "p_lead_sources_staff_rw" ON "public"."lead_sources" TO "authenticated" USING ("public"."is_staff"()) WITH CHECK ("public"."is_staff"());



CREATE POLICY "p_leads_public_insert" ON "public"."leads" FOR INSERT TO "authenticated", "anon" WITH CHECK ((("assigned_to" IS NULL) AND ("status" = 'new'::"text") AND ("converted_client_id" IS NULL) AND ("source_code" IS NOT NULL)));



CREATE POLICY "p_leads_team_rw" ON "public"."leads" TO "authenticated" USING (("public"."fn_is_owner_admin"() OR "public"."fn_is_intake"() OR "public"."fn_is_case_mgr"())) WITH CHECK (("public"."fn_is_owner_admin"() OR "public"."fn_is_intake"() OR "public"."fn_is_case_mgr"()));



CREATE POLICY "p_messages_client_read" ON "public"."messages" FOR SELECT USING ((("client_id" IN ( SELECT "clients"."id"
   FROM "public"."clients"
  WHERE ("clients"."portal_user_id" = "auth"."uid"()))) AND ("channel" = ANY (ARRAY['portal_chat'::"text", 'email'::"text", 'whatsapp'::"text"]))));



CREATE POLICY "p_messages_staff_rw" ON "public"."messages" USING ("public"."auth_is_staff"()) WITH CHECK ("public"."auth_is_staff"());



CREATE POLICY "p_notes_delete" ON "public"."entity_notes" FOR DELETE TO "authenticated" USING (("public"."fn_is_owner_admin"() OR (("created_by" = "auth"."uid"()) AND (NOT "is_locked"))));



CREATE POLICY "p_notes_insert" ON "public"."entity_notes" FOR INSERT TO "authenticated" WITH CHECK (("public"."fn_is_staff"() AND (("created_by" IS NULL) OR ("created_by" = "auth"."uid"()))));



CREATE POLICY "p_notes_select" ON "public"."entity_notes" FOR SELECT TO "authenticated" USING (("public"."fn_is_staff"() AND ((NOT "is_locked") OR ("created_by" = "auth"."uid"()) OR "public"."fn_is_owner_admin"())));



CREATE POLICY "p_notes_update" ON "public"."entity_notes" FOR UPDATE TO "authenticated" USING (("public"."fn_is_staff"() AND (("created_by" = "auth"."uid"()) OR "public"."fn_is_owner_admin"()))) WITH CHECK (("public"."fn_is_staff"() AND (("created_by" = "auth"."uid"()) OR "public"."fn_is_owner_admin"())));



CREATE POLICY "p_office_holidays_owner_admin_write" ON "public"."office_holidays" TO "authenticated" USING ("public"."auth_is_owner_or_admin"()) WITH CHECK ("public"."auth_is_owner_or_admin"());



CREATE POLICY "p_office_holidays_staff_read" ON "public"."office_holidays" FOR SELECT TO "authenticated" USING ("public"."is_staff"());



CREATE POLICY "p_office_hours_owner_admin_write" ON "public"."office_hours_config" TO "authenticated" USING ("public"."auth_is_owner_or_admin"()) WITH CHECK ("public"."auth_is_owner_or_admin"());



CREATE POLICY "p_office_hours_staff_read" ON "public"."office_hours_config" FOR SELECT TO "authenticated" USING ("public"."is_staff"());



CREATE POLICY "p_office_settings_owner_admin_write" ON "public"."office_settings" TO "authenticated" USING ("public"."auth_is_owner_or_admin"()) WITH CHECK ("public"."auth_is_owner_or_admin"());



CREATE POLICY "p_office_settings_staff_read" ON "public"."office_settings" FOR SELECT TO "authenticated" USING ("public"."is_staff"());



CREATE POLICY "p_outbound_owner_admin_all" ON "public"."outbound_messages" TO "authenticated" USING ("public"."auth_is_owner_or_admin"()) WITH CHECK ("public"."auth_is_owner_or_admin"());



CREATE POLICY "p_outbound_staff_insert_own" ON "public"."outbound_messages" FOR INSERT TO "authenticated" WITH CHECK (("public"."is_staff"() AND (("related_case_id" IN ( SELECT "cases"."id"
   FROM "public"."cases"
  WHERE (("cases"."case_manager_id" = "auth"."uid"()) OR ("cases"."senior_advisor_id" = "auth"."uid"())))) OR ("related_lead_id" IN ( SELECT "leads"."id"
   FROM "public"."leads"
  WHERE ("leads"."assigned_to" = "auth"."uid"()))))));



CREATE POLICY "p_outbound_staff_read_own" ON "public"."outbound_messages" FOR SELECT TO "authenticated" USING (("public"."is_staff"() AND (("related_case_id" IN ( SELECT "cases"."id"
   FROM "public"."cases"
  WHERE (("cases"."case_manager_id" = "auth"."uid"()) OR ("cases"."senior_advisor_id" = "auth"."uid"())))) OR ("related_lead_id" IN ( SELECT "leads"."id"
   FROM "public"."leads"
  WHERE ("leads"."assigned_to" = "auth"."uid"()))))));



CREATE POLICY "p_payments_finance" ON "public"."payments" TO "authenticated" USING ("public"."fn_is_finance"()) WITH CHECK ("public"."fn_is_finance"());



CREATE POLICY "p_prospective_staff_insert" ON "public"."prospective_applications" FOR INSERT TO "authenticated" WITH CHECK ("public"."fn_is_staff"());



CREATE POLICY "p_prospective_staff_read" ON "public"."prospective_applications" FOR SELECT TO "authenticated" USING ("public"."fn_is_staff"());



CREATE POLICY "p_prospective_staff_update" ON "public"."prospective_applications" FOR UPDATE TO "authenticated" USING ("public"."fn_is_staff"()) WITH CHECK ("public"."fn_is_staff"());



CREATE POLICY "p_qquestions_read" ON "public"."questionnaire_questions" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "p_qquestions_write" ON "public"."questionnaire_questions" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."staff_profiles" "sp"
  WHERE (("sp"."id" = "auth"."uid"()) AND ("sp"."role" = ANY (ARRAY['owner'::"text", 'admin'::"text", 'senior_advisor'::"text", 'senior_counsellor'::"text"])) AND ("sp"."is_active" = true))))) WITH CHECK (true);



CREATE POLICY "p_qresponse_items_select" ON "public"."questionnaire_response_items" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."questionnaire_responses" "qr"
  WHERE ("qr"."id" = "questionnaire_response_items"."response_id"))));



CREATE POLICY "p_qresponse_items_write" ON "public"."questionnaire_response_items" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."questionnaire_responses" "qr"
  WHERE ("qr"."id" = "questionnaire_response_items"."response_id")))) WITH CHECK (true);



CREATE POLICY "p_qresponses_select" ON "public"."questionnaire_responses" FOR SELECT TO "authenticated" USING (((EXISTS ( SELECT 1
   FROM "public"."staff_profiles" "sp"
  WHERE (("sp"."id" = "auth"."uid"()) AND ("sp"."role" = ANY (ARRAY['owner'::"text", 'admin'::"text", 'senior_advisor'::"text", 'senior_counsellor'::"text", 'visa_expert'::"text", 'case_manager'::"text", 'counsellor'::"text", 'tele_counsellor'::"text"])) AND ("sp"."is_active" = true)))) OR (("lead_id" IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM "public"."leads" "l"
  WHERE (("l"."id" = "questionnaire_responses"."lead_id") AND (("l"."assigned_to" = "auth"."uid"()) OR ("l"."created_by" = "auth"."uid"())))))) OR (("case_id" IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM "public"."cases" "c"
  WHERE (("c"."id" = "questionnaire_responses"."case_id") AND ("c"."case_manager_id" = "auth"."uid"())))))));



CREATE POLICY "p_qresponses_write" ON "public"."questionnaire_responses" TO "authenticated" USING (((EXISTS ( SELECT 1
   FROM "public"."staff_profiles" "sp"
  WHERE (("sp"."id" = "auth"."uid"()) AND ("sp"."role" = ANY (ARRAY['owner'::"text", 'admin'::"text", 'senior_advisor'::"text", 'senior_counsellor'::"text", 'visa_expert'::"text", 'case_manager'::"text", 'counsellor'::"text", 'tele_counsellor'::"text"])) AND ("sp"."is_active" = true)))) OR (("lead_id" IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM "public"."leads" "l"
  WHERE (("l"."id" = "questionnaire_responses"."lead_id") AND (("l"."assigned_to" = "auth"."uid"()) OR ("l"."created_by" = "auth"."uid"())))))) OR (("case_id" IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM "public"."cases" "c"
  WHERE (("c"."id" = "questionnaire_responses"."case_id") AND ("c"."case_manager_id" = "auth"."uid"()))))))) WITH CHECK (true);



CREATE POLICY "p_qsections_read" ON "public"."questionnaire_sections" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "p_qsections_write" ON "public"."questionnaire_sections" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."staff_profiles" "sp"
  WHERE (("sp"."id" = "auth"."uid"()) AND ("sp"."role" = ANY (ARRAY['owner'::"text", 'admin'::"text", 'senior_advisor'::"text", 'senior_counsellor'::"text"])) AND ("sp"."is_active" = true))))) WITH CHECK (true);



CREATE POLICY "p_qtemplates_read" ON "public"."questionnaire_templates" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "p_qtemplates_write" ON "public"."questionnaire_templates" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."staff_profiles" "sp"
  WHERE (("sp"."id" = "auth"."uid"()) AND ("sp"."role" = ANY (ARRAY['owner'::"text", 'admin'::"text", 'senior_advisor'::"text", 'senior_counsellor'::"text"])) AND ("sp"."is_active" = true))))) WITH CHECK (true);



CREATE POLICY "p_sla_staff" ON "public"."sla_rules" TO "authenticated" USING ("public"."is_staff"()) WITH CHECK ("public"."is_staff"());



CREATE POLICY "p_staff_self_read" ON "public"."staff_profiles" FOR SELECT TO "authenticated" USING ("public"."is_staff"());



CREATE POLICY "p_staff_self_update" ON "public"."staff_profiles" FOR UPDATE TO "authenticated" USING (("id" = "auth"."uid"())) WITH CHECK (("id" = "auth"."uid"()));



CREATE POLICY "p_stage_history_staff_all" ON "public"."case_stage_history" TO "authenticated" USING ("public"."is_staff"()) WITH CHECK ("public"."is_staff"());



CREATE POLICY "p_step_conditions_staff" ON "public"."step_conditions" TO "authenticated" USING ("public"."is_staff"()) WITH CHECK ("public"."is_staff"());



CREATE POLICY "p_step_edits_staff" ON "public"."step_template_edits" TO "authenticated" USING ("public"."is_staff"()) WITH CHECK ("public"."is_staff"());



CREATE POLICY "p_steps_staff" ON "public"."step_templates" TO "authenticated" USING ("public"."is_staff"()) WITH CHECK ("public"."is_staff"());



CREATE POLICY "p_task_statuses_public_read" ON "public"."task_statuses_ref" FOR SELECT TO "authenticated", "anon" USING (true);



CREATE POLICY "p_task_statuses_staff_rw" ON "public"."task_statuses_ref" TO "authenticated" USING ("public"."is_staff"()) WITH CHECK ("public"."is_staff"());



CREATE POLICY "p_tasks_role" ON "public"."tasks" TO "authenticated" USING (("public"."fn_is_owner_admin"() OR "public"."fn_is_case_mgr"() OR ("assigned_to" = "auth"."uid"()))) WITH CHECK (("public"."fn_is_owner_admin"() OR "public"."fn_is_case_mgr"() OR ("assigned_to" = "auth"."uid"())));



CREATE POLICY "p_timeline_owner_admin_all" ON "public"."activity_timeline" TO "authenticated" USING ("public"."auth_is_owner_or_admin"()) WITH CHECK ("public"."auth_is_owner_or_admin"());



CREATE POLICY "p_timeline_portal_self" ON "public"."activity_timeline" FOR SELECT TO "authenticated" USING (("case_id" IN ( SELECT "c"."id"
   FROM ("public"."cases" "c"
     JOIN "public"."clients" "cl" ON (("cl"."id" = "c"."client_id")))
  WHERE ("cl"."email" = "auth"."email"()))));



CREATE POLICY "p_timeline_staff_insert" ON "public"."activity_timeline" FOR INSERT TO "authenticated" WITH CHECK ("public"."fn_is_staff"());



CREATE POLICY "p_timeline_staff_read" ON "public"."activity_timeline" FOR SELECT TO "authenticated" USING ("public"."fn_is_staff"());



CREATE POLICY "p_trigger_events_staff" ON "public"."trigger_events" TO "authenticated" USING ("public"."is_staff"()) WITH CHECK ("public"."is_staff"());



CREATE POLICY "p_upsell_triggers_admin_write" ON "public"."upsell_triggers" TO "authenticated" USING ("public"."auth_is_owner_or_admin"()) WITH CHECK ("public"."auth_is_owner_or_admin"());



CREATE POLICY "p_upsell_triggers_staff_read" ON "public"."upsell_triggers" FOR SELECT TO "authenticated" USING ("public"."is_staff"());



CREATE POLICY "p_visa_categories_admin_write" ON "public"."visa_categories" TO "authenticated" USING ("public"."auth_is_owner_or_admin"()) WITH CHECK ("public"."auth_is_owner_or_admin"());



CREATE POLICY "p_visa_categories_staff_read" ON "public"."visa_categories" FOR SELECT TO "authenticated" USING ("public"."is_staff"());



CREATE POLICY "p_visa_sub_types_public_read" ON "public"."visa_sub_types" FOR SELECT TO "authenticated", "anon" USING (("is_active" = true));



CREATE POLICY "p_visa_sub_types_staff_rw" ON "public"."visa_sub_types" TO "authenticated" USING ("public"."is_staff"()) WITH CHECK ("public"."is_staff"());



CREATE POLICY "p_visa_types_public_read" ON "public"."visa_types" FOR SELECT TO "authenticated", "anon" USING (("is_active" = true));



CREATE POLICY "p_visa_types_staff_rw" ON "public"."visa_types" TO "authenticated" USING ("public"."is_staff"()) WITH CHECK ("public"."is_staff"());



ALTER TABLE "public"."payments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "payments_portal" ON "public"."payments" FOR SELECT TO "authenticated" USING (("invoice_id" IN ( SELECT "i"."id"
   FROM ("public"."invoices" "i"
     JOIN "public"."clients" "c" ON (("c"."id" = "i"."client_id")))
  WHERE ("lower"("c"."email") = "lower"(COALESCE(("auth"."jwt"() ->> 'email'::"text"), ''::"text"))))));



ALTER TABLE "public"."program_eligibility_rules" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."prospective_applications" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."questionnaire_questions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."questionnaire_response_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."questionnaire_responses" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."questionnaire_sections" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."questionnaire_templates" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."referral_partners" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "reveal_insert_own" ON "public"."contact_reveal_log" FOR INSERT TO "authenticated" WITH CHECK ((("staff_id" IN ( SELECT "staff_profiles"."id"
   FROM "public"."staff_profiles"
  WHERE ("staff_profiles"."id" = "auth"."uid"()))) OR ("staff_id" = "auth"."uid"())));



CREATE POLICY "reveal_select_admin" ON "public"."contact_reveal_log" FOR SELECT TO "authenticated" USING ("public"."auth_is_owner_or_admin"());



ALTER TABLE "public"."sla_rules" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "staff_all_agent_partners" ON "public"."agent_partners" TO "authenticated" USING (true) WITH CHECK (true);



ALTER TABLE "public"."staff_profiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "staff_profiles_block_anon_insert" ON "public"."staff_profiles" AS RESTRICTIVE FOR INSERT TO "anon" WITH CHECK (false);



CREATE POLICY "staff_profiles_block_anon_select" ON "public"."staff_profiles" AS RESTRICTIVE FOR SELECT TO "anon" USING (false);



ALTER TABLE "public"."step_conditions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."step_template_edits" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."step_templates" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."task_statuses_ref" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tasks" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."trigger_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."upsell_triggers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."visa_categories" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."visa_sub_types" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."visa_types" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."wa_templates" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."wa_webhook_events" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "wt_select" ON "public"."wa_templates" FOR SELECT TO "authenticated" USING ((("org_id" = "public"."default_org_id"()) AND "public"."comm_can_use"()));



CREATE POLICY "wt_write" ON "public"."wa_templates" TO "authenticated" USING ("public"."comm_is_manager"()) WITH CHECK ("public"."comm_is_manager"());





ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";






ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."comm_notifications";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."communication_events";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."conversations";









GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_in"("cstring") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_in"("cstring") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_in"("cstring") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_in"("cstring") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_out"("public"."gtrgm") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_out"("public"."gtrgm") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_out"("public"."gtrgm") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_out"("public"."gtrgm") TO "service_role";











































































































































































GRANT ALL ON FUNCTION "public"."app_settings_set_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."app_settings_set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."app_settings_set_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."auth_is_owner_or_admin"() TO "anon";
GRANT ALL ON FUNCTION "public"."auth_is_owner_or_admin"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."auth_is_owner_or_admin"() TO "service_role";



GRANT ALL ON FUNCTION "public"."auth_is_staff"() TO "anon";
GRANT ALL ON FUNCTION "public"."auth_is_staff"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."auth_is_staff"() TO "service_role";



GRANT ALL ON FUNCTION "public"."auth_role"() TO "anon";
GRANT ALL ON FUNCTION "public"."auth_role"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."auth_role"() TO "service_role";



GRANT ALL ON FUNCTION "public"."bulk_process_prospectives"("p_decisions" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."bulk_process_prospectives"("p_decisions" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."bulk_process_prospectives"("p_decisions" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."case_applicants_set_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."case_applicants_set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."case_applicants_set_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."default_org_id"() TO "anon";
GRANT ALL ON FUNCTION "public"."default_org_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."default_org_id"() TO "service_role";



GRANT ALL ON TABLE "public"."jobs" TO "anon";
GRANT ALL ON TABLE "public"."jobs" TO "authenticated";
GRANT ALL ON TABLE "public"."jobs" TO "service_role";



REVOKE ALL ON FUNCTION "public"."claim_jobs"("p_types" "text"[], "p_limit" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."claim_jobs"("p_types" "text"[], "p_limit" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."comm_can_use"() TO "anon";
GRANT ALL ON FUNCTION "public"."comm_can_use"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."comm_can_use"() TO "service_role";



GRANT ALL ON FUNCTION "public"."comm_is_manager"() TO "anon";
GRANT ALL ON FUNCTION "public"."comm_is_manager"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."comm_is_manager"() TO "service_role";



GRANT ALL ON FUNCTION "public"."comm_is_reception"() TO "anon";
GRANT ALL ON FUNCTION "public"."comm_is_reception"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."comm_is_reception"() TO "service_role";



GRANT ALL ON FUNCTION "public"."comm_me"() TO "anon";
GRANT ALL ON FUNCTION "public"."comm_me"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."comm_me"() TO "service_role";



GRANT ALL ON FUNCTION "public"."comm_my_role"() TO "anon";
GRANT ALL ON FUNCTION "public"."comm_my_role"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."comm_my_role"() TO "service_role";



GRANT ALL ON FUNCTION "public"."consent_prospective_to_case"("p_prospective_id" "uuid", "p_fee_quoted" numeric, "p_notes" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."consent_prospective_to_case"("p_prospective_id" "uuid", "p_fee_quoted" numeric, "p_notes" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."consent_prospective_to_case"("p_prospective_id" "uuid", "p_fee_quoted" numeric, "p_notes" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."decline_prospective"("p_prospective_id" "uuid", "p_reason" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."decline_prospective"("p_prospective_id" "uuid", "p_reason" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."decline_prospective"("p_prospective_id" "uuid", "p_reason" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."document_checklist_rules_set_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."document_checklist_rules_set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."document_checklist_rules_set_updated_at"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."enqueue_job"("p_type" "text", "p_payload" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."enqueue_job"("p_type" "text", "p_payload" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."ensure_family_unit"("p_lead_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."ensure_family_unit"("p_lead_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."ensure_family_unit"("p_lead_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."ensure_family_unit"("p_lead_id" "uuid", "p_unit_name" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."ensure_family_unit"("p_lead_id" "uuid", "p_unit_name" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."ensure_family_unit"("p_lead_id" "uuid", "p_unit_name" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."finish_job"("p_id" "uuid", "p_ok" boolean, "p_error" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."finish_job"("p_id" "uuid", "p_ok" boolean, "p_error" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."fn_add_staff"("p_email" "text", "p_full_name" "text", "p_role" "text", "p_phone" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."fn_add_staff"("p_email" "text", "p_full_name" "text", "p_role" "text", "p_phone" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."fn_add_staff"("p_email" "text", "p_full_name" "text", "p_role" "text", "p_phone" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_add_staff"("p_email" "text", "p_full_name" "text", "p_role" "text", "p_phone" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_assessment_facts"("p" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."fn_assessment_facts"("p" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_assessment_facts"("p" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."fn_assessment_on_submit"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."fn_assessment_on_submit"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_assessment_on_submit"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."fn_assessment_score"("p_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."fn_assessment_score"("p_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_assessment_score"("p_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_audit_ensure_partitions"("p_months_ahead" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."fn_audit_ensure_partitions"("p_months_ahead" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_audit_ensure_partitions"("p_months_ahead" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_build_assessment_sections"("p_template_code" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."fn_build_assessment_sections"("p_template_code" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_build_assessment_sections"("p_template_code" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_can_case"() TO "anon";
GRANT ALL ON FUNCTION "public"."fn_can_case"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_can_case"() TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_can_delete_leads"() TO "anon";
GRANT ALL ON FUNCTION "public"."fn_can_delete_leads"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_can_delete_leads"() TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_current_role"() TO "anon";
GRANT ALL ON FUNCTION "public"."fn_current_role"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_current_role"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."fn_delete_lead"("p_lead_id" "uuid", "p_reason" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."fn_delete_lead"("p_lead_id" "uuid", "p_reason" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."fn_delete_lead"("p_lead_id" "uuid", "p_reason" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_delete_lead"("p_lead_id" "uuid", "p_reason" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."fn_engine_chain_fire"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."fn_engine_chain_fire"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_engine_chain_fire"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."fn_engine_doc_expiry_sync"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."fn_engine_doc_expiry_sync"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_engine_doc_expiry_sync"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."fn_engine_expiry_sweep"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."fn_engine_expiry_sweep"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_engine_expiry_sweep"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."fn_engine_festival_sweep"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."fn_engine_festival_sweep"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_engine_festival_sweep"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."fn_engine_on_case_created"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."fn_engine_on_case_created"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_engine_on_case_created"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."fn_engine_on_lead_created"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."fn_engine_on_lead_created"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_engine_on_lead_created"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."fn_engine_on_stage_change"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."fn_engine_on_stage_change"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_engine_on_stage_change"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."fn_engine_outbox_sweep"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."fn_engine_outbox_sweep"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_engine_outbox_sweep"() TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_engine_owner"() TO "anon";
GRANT ALL ON FUNCTION "public"."fn_engine_owner"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_engine_owner"() TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_engine_queue_message"("p_template" "text", "p_client" "uuid", "p_lead" "uuid", "p_case" "uuid", "p_vars" "jsonb", "p_when" timestamp with time zone, "p_urgent" boolean, "p_trigger_event" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."fn_engine_queue_message"("p_template" "text", "p_client" "uuid", "p_lead" "uuid", "p_case" "uuid", "p_vars" "jsonb", "p_when" timestamp with time zone, "p_urgent" boolean, "p_trigger_event" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_engine_queue_message"("p_template" "text", "p_client" "uuid", "p_lead" "uuid", "p_case" "uuid", "p_vars" "jsonb", "p_when" timestamp with time zone, "p_urgent" boolean, "p_trigger_event" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."fn_engine_sla_sweep"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."fn_engine_sla_sweep"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_engine_sla_sweep"() TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_engine_staff_for_role"("p_role" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."fn_engine_staff_for_role"("p_role" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_engine_staff_for_role"("p_role" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_entity_notes_guard"() TO "anon";
GRANT ALL ON FUNCTION "public"."fn_entity_notes_guard"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_entity_notes_guard"() TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_entity_notes_timeline"() TO "anon";
GRANT ALL ON FUNCTION "public"."fn_entity_notes_timeline"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_entity_notes_timeline"() TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_eval_condition"("facts" "jsonb", "cond" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."fn_eval_condition"("facts" "jsonb", "cond" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_eval_condition"("facts" "jsonb", "cond" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_finance_entry_timeline"() TO "anon";
GRANT ALL ON FUNCTION "public"."fn_finance_entry_timeline"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_finance_entry_timeline"() TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_is_accounts"() TO "anon";
GRANT ALL ON FUNCTION "public"."fn_is_accounts"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_is_accounts"() TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_is_case_mgr"() TO "anon";
GRANT ALL ON FUNCTION "public"."fn_is_case_mgr"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_is_case_mgr"() TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_is_filing_ft"() TO "anon";
GRANT ALL ON FUNCTION "public"."fn_is_filing_ft"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_is_filing_ft"() TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_is_filing_pt"() TO "anon";
GRANT ALL ON FUNCTION "public"."fn_is_filing_pt"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_is_filing_pt"() TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_is_finance"() TO "anon";
GRANT ALL ON FUNCTION "public"."fn_is_finance"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_is_finance"() TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_is_intake"() TO "anon";
GRANT ALL ON FUNCTION "public"."fn_is_intake"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_is_intake"() TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_is_owner_admin"() TO "anon";
GRANT ALL ON FUNCTION "public"."fn_is_owner_admin"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_is_owner_admin"() TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_is_staff"() TO "anon";
GRANT ALL ON FUNCTION "public"."fn_is_staff"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_is_staff"() TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_leads_guard_delete"() TO "anon";
GRANT ALL ON FUNCTION "public"."fn_leads_guard_delete"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_leads_guard_delete"() TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_messaging_is_live"() TO "anon";
GRANT ALL ON FUNCTION "public"."fn_messaging_is_live"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_messaging_is_live"() TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_outbox_guard"() TO "anon";
GRANT ALL ON FUNCTION "public"."fn_outbox_guard"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_outbox_guard"() TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_program_class"("p_code" "text", "p_label" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."fn_program_class"("p_code" "text", "p_label" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_program_class"("p_code" "text", "p_label" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_tasks_supersede"() TO "anon";
GRANT ALL ON FUNCTION "public"."fn_tasks_supersede"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_tasks_supersede"() TO "service_role";



GRANT ALL ON FUNCTION "public"."gen_case_code"() TO "anon";
GRANT ALL ON FUNCTION "public"."gen_case_code"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."gen_case_code"() TO "service_role";



GRANT ALL ON FUNCTION "public"."gen_client_code"() TO "anon";
GRANT ALL ON FUNCTION "public"."gen_client_code"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."gen_client_code"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_family_members"("p_family_unit_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_family_members"("p_family_unit_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_family_members"("p_family_unit_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_btree_consistent"("internal", smallint, "anyelement", integer, "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_btree_consistent"("internal", smallint, "anyelement", integer, "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_btree_consistent"("internal", smallint, "anyelement", integer, "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_btree_consistent"("internal", smallint, "anyelement", integer, "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_compare_prefix_anyenum"("anyenum", "anyenum", smallint, "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_compare_prefix_anyenum"("anyenum", "anyenum", smallint, "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_compare_prefix_anyenum"("anyenum", "anyenum", smallint, "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_compare_prefix_anyenum"("anyenum", "anyenum", smallint, "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_compare_prefix_bit"(bit, bit, smallint, "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_compare_prefix_bit"(bit, bit, smallint, "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_compare_prefix_bit"(bit, bit, smallint, "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_compare_prefix_bit"(bit, bit, smallint, "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_compare_prefix_bool"(boolean, boolean, smallint, "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_compare_prefix_bool"(boolean, boolean, smallint, "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_compare_prefix_bool"(boolean, boolean, smallint, "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_compare_prefix_bool"(boolean, boolean, smallint, "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_compare_prefix_bpchar"(character, character, smallint, "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_compare_prefix_bpchar"(character, character, smallint, "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_compare_prefix_bpchar"(character, character, smallint, "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_compare_prefix_bpchar"(character, character, smallint, "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_compare_prefix_bytea"("bytea", "bytea", smallint, "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_compare_prefix_bytea"("bytea", "bytea", smallint, "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_compare_prefix_bytea"("bytea", "bytea", smallint, "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_compare_prefix_bytea"("bytea", "bytea", smallint, "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_compare_prefix_char"("char", "char", smallint, "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_compare_prefix_char"("char", "char", smallint, "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_compare_prefix_char"("char", "char", smallint, "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_compare_prefix_char"("char", "char", smallint, "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_compare_prefix_cidr"("cidr", "cidr", smallint, "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_compare_prefix_cidr"("cidr", "cidr", smallint, "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_compare_prefix_cidr"("cidr", "cidr", smallint, "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_compare_prefix_cidr"("cidr", "cidr", smallint, "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_compare_prefix_date"("date", "date", smallint, "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_compare_prefix_date"("date", "date", smallint, "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_compare_prefix_date"("date", "date", smallint, "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_compare_prefix_date"("date", "date", smallint, "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_compare_prefix_float4"(real, real, smallint, "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_compare_prefix_float4"(real, real, smallint, "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_compare_prefix_float4"(real, real, smallint, "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_compare_prefix_float4"(real, real, smallint, "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_compare_prefix_float8"(double precision, double precision, smallint, "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_compare_prefix_float8"(double precision, double precision, smallint, "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_compare_prefix_float8"(double precision, double precision, smallint, "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_compare_prefix_float8"(double precision, double precision, smallint, "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_compare_prefix_inet"("inet", "inet", smallint, "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_compare_prefix_inet"("inet", "inet", smallint, "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_compare_prefix_inet"("inet", "inet", smallint, "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_compare_prefix_inet"("inet", "inet", smallint, "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_compare_prefix_int2"(smallint, smallint, smallint, "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_compare_prefix_int2"(smallint, smallint, smallint, "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_compare_prefix_int2"(smallint, smallint, smallint, "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_compare_prefix_int2"(smallint, smallint, smallint, "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_compare_prefix_int4"(integer, integer, smallint, "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_compare_prefix_int4"(integer, integer, smallint, "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_compare_prefix_int4"(integer, integer, smallint, "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_compare_prefix_int4"(integer, integer, smallint, "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_compare_prefix_int8"(bigint, bigint, smallint, "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_compare_prefix_int8"(bigint, bigint, smallint, "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_compare_prefix_int8"(bigint, bigint, smallint, "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_compare_prefix_int8"(bigint, bigint, smallint, "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_compare_prefix_interval"(interval, interval, smallint, "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_compare_prefix_interval"(interval, interval, smallint, "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_compare_prefix_interval"(interval, interval, smallint, "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_compare_prefix_interval"(interval, interval, smallint, "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_compare_prefix_macaddr"("macaddr", "macaddr", smallint, "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_compare_prefix_macaddr"("macaddr", "macaddr", smallint, "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_compare_prefix_macaddr"("macaddr", "macaddr", smallint, "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_compare_prefix_macaddr"("macaddr", "macaddr", smallint, "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_compare_prefix_macaddr8"("macaddr8", "macaddr8", smallint, "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_compare_prefix_macaddr8"("macaddr8", "macaddr8", smallint, "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_compare_prefix_macaddr8"("macaddr8", "macaddr8", smallint, "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_compare_prefix_macaddr8"("macaddr8", "macaddr8", smallint, "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_compare_prefix_money"("money", "money", smallint, "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_compare_prefix_money"("money", "money", smallint, "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_compare_prefix_money"("money", "money", smallint, "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_compare_prefix_money"("money", "money", smallint, "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_compare_prefix_name"("name", "name", smallint, "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_compare_prefix_name"("name", "name", smallint, "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_compare_prefix_name"("name", "name", smallint, "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_compare_prefix_name"("name", "name", smallint, "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_compare_prefix_numeric"(numeric, numeric, smallint, "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_compare_prefix_numeric"(numeric, numeric, smallint, "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_compare_prefix_numeric"(numeric, numeric, smallint, "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_compare_prefix_numeric"(numeric, numeric, smallint, "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_compare_prefix_oid"("oid", "oid", smallint, "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_compare_prefix_oid"("oid", "oid", smallint, "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_compare_prefix_oid"("oid", "oid", smallint, "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_compare_prefix_oid"("oid", "oid", smallint, "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_compare_prefix_text"("text", "text", smallint, "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_compare_prefix_text"("text", "text", smallint, "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_compare_prefix_text"("text", "text", smallint, "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_compare_prefix_text"("text", "text", smallint, "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_compare_prefix_time"(time without time zone, time without time zone, smallint, "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_compare_prefix_time"(time without time zone, time without time zone, smallint, "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_compare_prefix_time"(time without time zone, time without time zone, smallint, "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_compare_prefix_time"(time without time zone, time without time zone, smallint, "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_compare_prefix_timestamp"(timestamp without time zone, timestamp without time zone, smallint, "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_compare_prefix_timestamp"(timestamp without time zone, timestamp without time zone, smallint, "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_compare_prefix_timestamp"(timestamp without time zone, timestamp without time zone, smallint, "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_compare_prefix_timestamp"(timestamp without time zone, timestamp without time zone, smallint, "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_compare_prefix_timestamptz"(timestamp with time zone, timestamp with time zone, smallint, "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_compare_prefix_timestamptz"(timestamp with time zone, timestamp with time zone, smallint, "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_compare_prefix_timestamptz"(timestamp with time zone, timestamp with time zone, smallint, "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_compare_prefix_timestamptz"(timestamp with time zone, timestamp with time zone, smallint, "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_compare_prefix_timetz"(time with time zone, time with time zone, smallint, "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_compare_prefix_timetz"(time with time zone, time with time zone, smallint, "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_compare_prefix_timetz"(time with time zone, time with time zone, smallint, "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_compare_prefix_timetz"(time with time zone, time with time zone, smallint, "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_compare_prefix_uuid"("uuid", "uuid", smallint, "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_compare_prefix_uuid"("uuid", "uuid", smallint, "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_compare_prefix_uuid"("uuid", "uuid", smallint, "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_compare_prefix_uuid"("uuid", "uuid", smallint, "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_compare_prefix_varbit"(bit varying, bit varying, smallint, "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_compare_prefix_varbit"(bit varying, bit varying, smallint, "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_compare_prefix_varbit"(bit varying, bit varying, smallint, "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_compare_prefix_varbit"(bit varying, bit varying, smallint, "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_enum_cmp"("anyenum", "anyenum") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_enum_cmp"("anyenum", "anyenum") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_enum_cmp"("anyenum", "anyenum") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_enum_cmp"("anyenum", "anyenum") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_extract_query_anyenum"("anyenum", "internal", smallint, "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_query_anyenum"("anyenum", "internal", smallint, "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_query_anyenum"("anyenum", "internal", smallint, "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_query_anyenum"("anyenum", "internal", smallint, "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_extract_query_bit"(bit, "internal", smallint, "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_query_bit"(bit, "internal", smallint, "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_query_bit"(bit, "internal", smallint, "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_query_bit"(bit, "internal", smallint, "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_extract_query_bool"(boolean, "internal", smallint, "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_query_bool"(boolean, "internal", smallint, "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_query_bool"(boolean, "internal", smallint, "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_query_bool"(boolean, "internal", smallint, "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_extract_query_bpchar"(character, "internal", smallint, "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_query_bpchar"(character, "internal", smallint, "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_query_bpchar"(character, "internal", smallint, "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_query_bpchar"(character, "internal", smallint, "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_extract_query_bytea"("bytea", "internal", smallint, "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_query_bytea"("bytea", "internal", smallint, "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_query_bytea"("bytea", "internal", smallint, "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_query_bytea"("bytea", "internal", smallint, "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_extract_query_char"("char", "internal", smallint, "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_query_char"("char", "internal", smallint, "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_query_char"("char", "internal", smallint, "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_query_char"("char", "internal", smallint, "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_extract_query_cidr"("cidr", "internal", smallint, "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_query_cidr"("cidr", "internal", smallint, "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_query_cidr"("cidr", "internal", smallint, "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_query_cidr"("cidr", "internal", smallint, "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_extract_query_date"("date", "internal", smallint, "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_query_date"("date", "internal", smallint, "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_query_date"("date", "internal", smallint, "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_query_date"("date", "internal", smallint, "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_extract_query_float4"(real, "internal", smallint, "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_query_float4"(real, "internal", smallint, "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_query_float4"(real, "internal", smallint, "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_query_float4"(real, "internal", smallint, "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_extract_query_float8"(double precision, "internal", smallint, "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_query_float8"(double precision, "internal", smallint, "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_query_float8"(double precision, "internal", smallint, "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_query_float8"(double precision, "internal", smallint, "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_extract_query_inet"("inet", "internal", smallint, "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_query_inet"("inet", "internal", smallint, "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_query_inet"("inet", "internal", smallint, "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_query_inet"("inet", "internal", smallint, "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_extract_query_int2"(smallint, "internal", smallint, "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_query_int2"(smallint, "internal", smallint, "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_query_int2"(smallint, "internal", smallint, "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_query_int2"(smallint, "internal", smallint, "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_extract_query_int4"(integer, "internal", smallint, "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_query_int4"(integer, "internal", smallint, "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_query_int4"(integer, "internal", smallint, "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_query_int4"(integer, "internal", smallint, "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_extract_query_int8"(bigint, "internal", smallint, "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_query_int8"(bigint, "internal", smallint, "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_query_int8"(bigint, "internal", smallint, "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_query_int8"(bigint, "internal", smallint, "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_extract_query_interval"(interval, "internal", smallint, "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_query_interval"(interval, "internal", smallint, "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_query_interval"(interval, "internal", smallint, "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_query_interval"(interval, "internal", smallint, "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_extract_query_macaddr"("macaddr", "internal", smallint, "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_query_macaddr"("macaddr", "internal", smallint, "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_query_macaddr"("macaddr", "internal", smallint, "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_query_macaddr"("macaddr", "internal", smallint, "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_extract_query_macaddr8"("macaddr8", "internal", smallint, "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_query_macaddr8"("macaddr8", "internal", smallint, "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_query_macaddr8"("macaddr8", "internal", smallint, "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_query_macaddr8"("macaddr8", "internal", smallint, "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_extract_query_money"("money", "internal", smallint, "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_query_money"("money", "internal", smallint, "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_query_money"("money", "internal", smallint, "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_query_money"("money", "internal", smallint, "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_extract_query_name"("name", "internal", smallint, "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_query_name"("name", "internal", smallint, "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_query_name"("name", "internal", smallint, "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_query_name"("name", "internal", smallint, "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_extract_query_numeric"(numeric, "internal", smallint, "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_query_numeric"(numeric, "internal", smallint, "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_query_numeric"(numeric, "internal", smallint, "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_query_numeric"(numeric, "internal", smallint, "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_extract_query_oid"("oid", "internal", smallint, "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_query_oid"("oid", "internal", smallint, "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_query_oid"("oid", "internal", smallint, "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_query_oid"("oid", "internal", smallint, "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_extract_query_text"("text", "internal", smallint, "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_query_text"("text", "internal", smallint, "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_query_text"("text", "internal", smallint, "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_query_text"("text", "internal", smallint, "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_extract_query_time"(time without time zone, "internal", smallint, "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_query_time"(time without time zone, "internal", smallint, "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_query_time"(time without time zone, "internal", smallint, "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_query_time"(time without time zone, "internal", smallint, "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_extract_query_timestamp"(timestamp without time zone, "internal", smallint, "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_query_timestamp"(timestamp without time zone, "internal", smallint, "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_query_timestamp"(timestamp without time zone, "internal", smallint, "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_query_timestamp"(timestamp without time zone, "internal", smallint, "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_extract_query_timestamptz"(timestamp with time zone, "internal", smallint, "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_query_timestamptz"(timestamp with time zone, "internal", smallint, "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_query_timestamptz"(timestamp with time zone, "internal", smallint, "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_query_timestamptz"(timestamp with time zone, "internal", smallint, "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_extract_query_timetz"(time with time zone, "internal", smallint, "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_query_timetz"(time with time zone, "internal", smallint, "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_query_timetz"(time with time zone, "internal", smallint, "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_query_timetz"(time with time zone, "internal", smallint, "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_extract_query_trgm"("text", "internal", smallint, "internal", "internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_query_trgm"("text", "internal", smallint, "internal", "internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_query_trgm"("text", "internal", smallint, "internal", "internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_query_trgm"("text", "internal", smallint, "internal", "internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_extract_query_uuid"("uuid", "internal", smallint, "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_query_uuid"("uuid", "internal", smallint, "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_query_uuid"("uuid", "internal", smallint, "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_query_uuid"("uuid", "internal", smallint, "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_extract_query_varbit"(bit varying, "internal", smallint, "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_query_varbit"(bit varying, "internal", smallint, "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_query_varbit"(bit varying, "internal", smallint, "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_query_varbit"(bit varying, "internal", smallint, "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_extract_value_anyenum"("anyenum", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_value_anyenum"("anyenum", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_value_anyenum"("anyenum", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_value_anyenum"("anyenum", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_extract_value_bit"(bit, "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_value_bit"(bit, "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_value_bit"(bit, "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_value_bit"(bit, "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_extract_value_bool"(boolean, "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_value_bool"(boolean, "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_value_bool"(boolean, "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_value_bool"(boolean, "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_extract_value_bpchar"(character, "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_value_bpchar"(character, "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_value_bpchar"(character, "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_value_bpchar"(character, "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_extract_value_bytea"("bytea", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_value_bytea"("bytea", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_value_bytea"("bytea", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_value_bytea"("bytea", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_extract_value_char"("char", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_value_char"("char", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_value_char"("char", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_value_char"("char", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_extract_value_cidr"("cidr", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_value_cidr"("cidr", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_value_cidr"("cidr", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_value_cidr"("cidr", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_extract_value_date"("date", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_value_date"("date", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_value_date"("date", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_value_date"("date", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_extract_value_float4"(real, "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_value_float4"(real, "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_value_float4"(real, "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_value_float4"(real, "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_extract_value_float8"(double precision, "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_value_float8"(double precision, "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_value_float8"(double precision, "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_value_float8"(double precision, "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_extract_value_inet"("inet", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_value_inet"("inet", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_value_inet"("inet", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_value_inet"("inet", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_extract_value_int2"(smallint, "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_value_int2"(smallint, "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_value_int2"(smallint, "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_value_int2"(smallint, "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_extract_value_int4"(integer, "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_value_int4"(integer, "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_value_int4"(integer, "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_value_int4"(integer, "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_extract_value_int8"(bigint, "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_value_int8"(bigint, "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_value_int8"(bigint, "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_value_int8"(bigint, "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_extract_value_interval"(interval, "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_value_interval"(interval, "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_value_interval"(interval, "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_value_interval"(interval, "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_extract_value_macaddr"("macaddr", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_value_macaddr"("macaddr", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_value_macaddr"("macaddr", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_value_macaddr"("macaddr", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_extract_value_macaddr8"("macaddr8", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_value_macaddr8"("macaddr8", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_value_macaddr8"("macaddr8", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_value_macaddr8"("macaddr8", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_extract_value_money"("money", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_value_money"("money", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_value_money"("money", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_value_money"("money", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_extract_value_name"("name", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_value_name"("name", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_value_name"("name", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_value_name"("name", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_extract_value_numeric"(numeric, "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_value_numeric"(numeric, "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_value_numeric"(numeric, "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_value_numeric"(numeric, "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_extract_value_oid"("oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_value_oid"("oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_value_oid"("oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_value_oid"("oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_extract_value_text"("text", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_value_text"("text", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_value_text"("text", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_value_text"("text", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_extract_value_time"(time without time zone, "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_value_time"(time without time zone, "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_value_time"(time without time zone, "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_value_time"(time without time zone, "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_extract_value_timestamp"(timestamp without time zone, "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_value_timestamp"(timestamp without time zone, "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_value_timestamp"(timestamp without time zone, "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_value_timestamp"(timestamp without time zone, "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_extract_value_timestamptz"(timestamp with time zone, "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_value_timestamptz"(timestamp with time zone, "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_value_timestamptz"(timestamp with time zone, "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_value_timestamptz"(timestamp with time zone, "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_extract_value_timetz"(time with time zone, "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_value_timetz"(time with time zone, "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_value_timetz"(time with time zone, "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_value_timetz"(time with time zone, "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_extract_value_trgm"("text", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_value_trgm"("text", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_value_trgm"("text", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_value_trgm"("text", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_extract_value_uuid"("uuid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_value_uuid"("uuid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_value_uuid"("uuid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_value_uuid"("uuid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_extract_value_varbit"(bit varying, "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_value_varbit"(bit varying, "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_value_varbit"(bit varying, "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_value_varbit"(bit varying, "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_numeric_cmp"(numeric, numeric) TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_numeric_cmp"(numeric, numeric) TO "anon";
GRANT ALL ON FUNCTION "public"."gin_numeric_cmp"(numeric, numeric) TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_numeric_cmp"(numeric, numeric) TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_trgm_consistent"("internal", smallint, "text", integer, "internal", "internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_trgm_consistent"("internal", smallint, "text", integer, "internal", "internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_trgm_consistent"("internal", smallint, "text", integer, "internal", "internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_trgm_consistent"("internal", smallint, "text", integer, "internal", "internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_trgm_triconsistent"("internal", smallint, "text", integer, "internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_trgm_triconsistent"("internal", smallint, "text", integer, "internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_trgm_triconsistent"("internal", smallint, "text", integer, "internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_trgm_triconsistent"("internal", smallint, "text", integer, "internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_consistent"("internal", "text", smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_consistent"("internal", "text", smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_consistent"("internal", "text", smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_consistent"("internal", "text", smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_decompress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_decompress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_decompress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_decompress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_distance"("internal", "text", smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_distance"("internal", "text", smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_distance"("internal", "text", smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_distance"("internal", "text", smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_options"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_options"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_options"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_options"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_penalty"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_penalty"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_penalty"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_penalty"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_picksplit"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_picksplit"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_picksplit"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_picksplit"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_same"("public"."gtrgm", "public"."gtrgm", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_same"("public"."gtrgm", "public"."gtrgm", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_same"("public"."gtrgm", "public"."gtrgm", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_same"("public"."gtrgm", "public"."gtrgm", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_union"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_union"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_union"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_union"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."identity_channels"("p_channel" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."identity_channels"("p_channel" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."identity_channels"("p_channel" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_staff"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_staff"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_staff"() TO "service_role";



GRANT ALL ON FUNCTION "public"."log_stage_change"() TO "anon";
GRANT ALL ON FUNCTION "public"."log_stage_change"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."log_stage_change"() TO "service_role";



GRANT ALL ON FUNCTION "public"."mark_case_outcome"("p_case_id" "uuid", "p_outcome" "text", "p_decision_date" "date", "p_study_end_date" "date", "p_document_expiry_date" "date", "p_pgwp_expiry_date" "date", "p_landing_date" "date", "p_first_canadian_work_day" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."mark_case_outcome"("p_case_id" "uuid", "p_outcome" "text", "p_decision_date" "date", "p_study_end_date" "date", "p_document_expiry_date" "date", "p_pgwp_expiry_date" "date", "p_landing_date" "date", "p_first_canadian_work_day" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."mark_case_outcome"("p_case_id" "uuid", "p_outcome" "text", "p_decision_date" "date", "p_study_end_date" "date", "p_document_expiry_date" "date", "p_pgwp_expiry_date" "date", "p_landing_date" "date", "p_first_canadian_work_day" "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."mark_conversation_read"("p_conversation" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."mark_conversation_read"("p_conversation" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."mark_conversation_read"("p_conversation" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."mask_email"("e" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."mask_email"("e" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."mask_email"("e" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."mask_phone"("p" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."mask_phone"("p" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."mask_phone"("p" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."normalize_email"("p" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."normalize_email"("p" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."normalize_email"("p" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."normalize_phone"("p" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."normalize_phone"("p" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."normalize_phone"("p" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."populate_case_documents_from_rules"("p_case_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."populate_case_documents_from_rules"("p_case_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."populate_case_documents_from_rules"("p_case_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."questionnaire_responses_set_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."questionnaire_responses_set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."questionnaire_responses_set_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."questionnaire_templates_set_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."questionnaire_templates_set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."questionnaire_templates_set_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."refresh_dashboard_views"() TO "anon";
GRANT ALL ON FUNCTION "public"."refresh_dashboard_views"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."refresh_dashboard_views"() TO "service_role";



GRANT ALL ON FUNCTION "public"."resolve_identity"("p_channel" "text", "p_handle" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."resolve_identity"("p_channel" "text", "p_handle" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."resolve_identity"("p_channel" "text", "p_handle" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."set_limit"(real) TO "postgres";
GRANT ALL ON FUNCTION "public"."set_limit"(real) TO "anon";
GRANT ALL ON FUNCTION "public"."set_limit"(real) TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_limit"(real) TO "service_role";



GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."show_limit"() TO "postgres";
GRANT ALL ON FUNCTION "public"."show_limit"() TO "anon";
GRANT ALL ON FUNCTION "public"."show_limit"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."show_limit"() TO "service_role";



GRANT ALL ON FUNCTION "public"."show_trgm"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."show_trgm"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."show_trgm"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."show_trgm"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."similarity"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."similarity"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."similarity"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."similarity"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."similarity_dist"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."similarity_dist"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."similarity_dist"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."similarity_dist"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."similarity_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."similarity_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."similarity_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."similarity_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."snooze_prospective"("p_prospective_id" "uuid", "p_snooze_days" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."snooze_prospective"("p_prospective_id" "uuid", "p_snooze_days" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."snooze_prospective"("p_prospective_id" "uuid", "p_snooze_days" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."staff_profiles_block_self_escalation"() TO "anon";
GRANT ALL ON FUNCTION "public"."staff_profiles_block_self_escalation"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."staff_profiles_block_self_escalation"() TO "service_role";



GRANT ALL ON FUNCTION "public"."strict_word_similarity"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."strict_word_similarity"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."strict_word_similarity"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strict_word_similarity"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."strict_word_similarity_commutator_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_commutator_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_commutator_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_commutator_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_commutator_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_commutator_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_commutator_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_commutator_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."strict_word_similarity_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."task_acknowledge"("p_task" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."task_acknowledge"("p_task" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."task_acknowledge"("p_task" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."task_complete"("p_task" "uuid", "p_notes" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."task_complete"("p_task" "uuid", "p_notes" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."task_complete"("p_task" "uuid", "p_notes" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."task_dismiss"("p_task" "uuid", "p_reason" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."task_dismiss"("p_task" "uuid", "p_reason" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."task_dismiss"("p_task" "uuid", "p_reason" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."unaccent"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."unaccent"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."unaccent"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."unaccent"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."unaccent"("regdictionary", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."unaccent"("regdictionary", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."unaccent"("regdictionary", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."unaccent"("regdictionary", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."unaccent_init"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."unaccent_init"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."unaccent_init"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."unaccent_init"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."unaccent_lexize"("internal", "internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."unaccent_lexize"("internal", "internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."unaccent_lexize"("internal", "internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."unaccent_lexize"("internal", "internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."wa_window_state"("p_conversation" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."wa_window_state"("p_conversation" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."wa_window_state"("p_conversation" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."word_similarity"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."word_similarity"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."word_similarity"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."word_similarity"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."word_similarity_commutator_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."word_similarity_commutator_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."word_similarity_commutator_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."word_similarity_commutator_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."word_similarity_dist_commutator_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_commutator_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_commutator_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_commutator_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."word_similarity_dist_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."word_similarity_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."word_similarity_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."word_similarity_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."word_similarity_op"("text", "text") TO "service_role";
























GRANT ALL ON TABLE "public"."_backup_clients_20260712" TO "anon";
GRANT ALL ON TABLE "public"."_backup_clients_20260712" TO "authenticated";
GRANT ALL ON TABLE "public"."_backup_clients_20260712" TO "service_role";



GRANT ALL ON TABLE "public"."_backup_clients_20260715" TO "anon";
GRANT ALL ON TABLE "public"."_backup_clients_20260715" TO "authenticated";
GRANT ALL ON TABLE "public"."_backup_clients_20260715" TO "service_role";



GRANT ALL ON TABLE "public"."_backup_clients_dupes_20260712" TO "anon";
GRANT ALL ON TABLE "public"."_backup_clients_dupes_20260712" TO "authenticated";
GRANT ALL ON TABLE "public"."_backup_clients_dupes_20260712" TO "service_role";



GRANT ALL ON TABLE "public"."_backup_clients_dupes_20260715" TO "anon";
GRANT ALL ON TABLE "public"."_backup_clients_dupes_20260715" TO "authenticated";
GRANT ALL ON TABLE "public"."_backup_clients_dupes_20260715" TO "service_role";



GRANT ALL ON TABLE "public"."_backup_leads_20260712" TO "anon";
GRANT ALL ON TABLE "public"."_backup_leads_20260712" TO "authenticated";
GRANT ALL ON TABLE "public"."_backup_leads_20260712" TO "service_role";



GRANT ALL ON TABLE "public"."_backup_leads_20260715" TO "anon";
GRANT ALL ON TABLE "public"."_backup_leads_20260715" TO "authenticated";
GRANT ALL ON TABLE "public"."_backup_leads_20260715" TO "service_role";



GRANT ALL ON TABLE "public"."_backup_visa_types_20260717" TO "anon";
GRANT ALL ON TABLE "public"."_backup_visa_types_20260717" TO "authenticated";
GRANT ALL ON TABLE "public"."_backup_visa_types_20260717" TO "service_role";



GRANT ALL ON TABLE "public"."_bak_assessment_forms_20260729" TO "anon";
GRANT ALL ON TABLE "public"."_bak_assessment_forms_20260729" TO "authenticated";
GRANT ALL ON TABLE "public"."_bak_assessment_forms_20260729" TO "service_role";



GRANT ALL ON TABLE "public"."activity_timeline" TO "anon";
GRANT ALL ON TABLE "public"."activity_timeline" TO "authenticated";
GRANT ALL ON TABLE "public"."activity_timeline" TO "service_role";



GRANT ALL ON TABLE "public"."activity_log" TO "anon";
GRANT ALL ON TABLE "public"."activity_log" TO "authenticated";
GRANT ALL ON TABLE "public"."activity_log" TO "service_role";



GRANT ALL ON TABLE "public"."agent_partners" TO "anon";
GRANT ALL ON TABLE "public"."agent_partners" TO "authenticated";
GRANT ALL ON TABLE "public"."agent_partners" TO "service_role";



GRANT ALL ON TABLE "public"."api_keys" TO "anon";
GRANT ALL ON TABLE "public"."api_keys" TO "authenticated";
GRANT ALL ON TABLE "public"."api_keys" TO "service_role";



GRANT ALL ON TABLE "public"."app_settings" TO "anon";
GRANT ALL ON TABLE "public"."app_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."app_settings" TO "service_role";



GRANT ALL ON TABLE "public"."applicant_relationships" TO "anon";
GRANT ALL ON TABLE "public"."applicant_relationships" TO "authenticated";
GRANT ALL ON TABLE "public"."applicant_relationships" TO "service_role";



GRANT ALL ON TABLE "public"."cases" TO "anon";
GRANT ALL ON TABLE "public"."cases" TO "authenticated";
GRANT ALL ON TABLE "public"."cases" TO "service_role";



GRANT ALL ON TABLE "public"."applications" TO "anon";
GRANT ALL ON TABLE "public"."applications" TO "authenticated";
GRANT ALL ON TABLE "public"."applications" TO "service_role";



GRANT ALL ON TABLE "public"."appointments" TO "anon";
GRANT ALL ON TABLE "public"."appointments" TO "authenticated";
GRANT ALL ON TABLE "public"."appointments" TO "service_role";



GRANT ALL ON TABLE "public"."assessment_forms" TO "anon";
GRANT ALL ON TABLE "public"."assessment_forms" TO "authenticated";
GRANT ALL ON TABLE "public"."assessment_forms" TO "service_role";



GRANT ALL ON TABLE "public"."assessments" TO "anon";
GRANT ALL ON TABLE "public"."assessments" TO "authenticated";
GRANT ALL ON TABLE "public"."assessments" TO "service_role";



GRANT ALL ON TABLE "public"."audit_log" TO "anon";
GRANT ALL ON TABLE "public"."audit_log" TO "authenticated";
GRANT ALL ON TABLE "public"."audit_log" TO "service_role";



GRANT ALL ON TABLE "public"."audit_log_2026_04" TO "service_role";



GRANT ALL ON TABLE "public"."audit_log_2026_05" TO "service_role";



GRANT ALL ON TABLE "public"."audit_log_2026_06" TO "service_role";



GRANT ALL ON TABLE "public"."audit_log_2026_07" TO "service_role";



GRANT ALL ON TABLE "public"."audit_log_2026_08" TO "service_role";



GRANT ALL ON TABLE "public"."audit_log_2026_09" TO "service_role";



GRANT ALL ON TABLE "public"."audit_log_2026_10" TO "service_role";



GRANT ALL ON TABLE "public"."audit_log_2026_11" TO "service_role";



GRANT ALL ON TABLE "public"."audit_log_2026_12" TO "service_role";



GRANT ALL ON TABLE "public"."audit_log_2027_01" TO "service_role";



GRANT ALL ON TABLE "public"."audit_log_2027_02" TO "service_role";



GRANT ALL ON TABLE "public"."audit_log_default" TO "service_role";



GRANT ALL ON TABLE "public"."call_logs" TO "anon";
GRANT ALL ON TABLE "public"."call_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."call_logs" TO "service_role";



GRANT ALL ON TABLE "public"."case_applicants" TO "anon";
GRANT ALL ON TABLE "public"."case_applicants" TO "authenticated";
GRANT ALL ON TABLE "public"."case_applicants" TO "service_role";



GRANT ALL ON SEQUENCE "public"."case_code_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."case_code_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."case_code_seq" TO "service_role";



GRANT ALL ON TABLE "public"."case_documents" TO "anon";
GRANT ALL ON TABLE "public"."case_documents" TO "authenticated";
GRANT ALL ON TABLE "public"."case_documents" TO "service_role";



GRANT ALL ON TABLE "public"."case_notes" TO "anon";
GRANT ALL ON TABLE "public"."case_notes" TO "authenticated";
GRANT ALL ON TABLE "public"."case_notes" TO "service_role";



GRANT ALL ON TABLE "public"."case_requests" TO "anon";
GRANT ALL ON TABLE "public"."case_requests" TO "authenticated";
GRANT ALL ON TABLE "public"."case_requests" TO "service_role";



GRANT ALL ON TABLE "public"."case_stage_history" TO "anon";
GRANT ALL ON TABLE "public"."case_stage_history" TO "authenticated";
GRANT ALL ON TABLE "public"."case_stage_history" TO "service_role";



GRANT ALL ON TABLE "public"."case_stages_ref" TO "anon";
GRANT ALL ON TABLE "public"."case_stages_ref" TO "authenticated";
GRANT ALL ON TABLE "public"."case_stages_ref" TO "service_role";



GRANT ALL ON TABLE "public"."chain_rules" TO "anon";
GRANT ALL ON TABLE "public"."chain_rules" TO "authenticated";
GRANT ALL ON TABLE "public"."chain_rules" TO "service_role";



GRANT ALL ON SEQUENCE "public"."client_code_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."client_code_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."client_code_seq" TO "service_role";



GRANT ALL ON TABLE "public"."clients" TO "anon";
GRANT ALL ON TABLE "public"."clients" TO "authenticated";
GRANT ALL ON TABLE "public"."clients" TO "service_role";



GRANT ALL ON TABLE "public"."comm_attachments" TO "anon";
GRANT ALL ON TABLE "public"."comm_attachments" TO "authenticated";
GRANT ALL ON TABLE "public"."comm_attachments" TO "service_role";



GRANT ALL ON TABLE "public"."comm_audit_logs" TO "anon";
GRANT ALL ON TABLE "public"."comm_audit_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."comm_audit_logs" TO "service_role";



GRANT ALL ON TABLE "public"."comm_notifications" TO "anon";
GRANT ALL ON TABLE "public"."comm_notifications" TO "authenticated";
GRANT ALL ON TABLE "public"."comm_notifications" TO "service_role";



GRANT ALL ON TABLE "public"."commission_rules" TO "anon";
GRANT ALL ON TABLE "public"."commission_rules" TO "authenticated";
GRANT ALL ON TABLE "public"."commission_rules" TO "service_role";



GRANT ALL ON TABLE "public"."commissions" TO "anon";
GRANT ALL ON TABLE "public"."commissions" TO "authenticated";
GRANT ALL ON TABLE "public"."commissions" TO "service_role";



GRANT ALL ON TABLE "public"."communication_events" TO "anon";
GRANT ALL ON TABLE "public"."communication_events" TO "authenticated";
GRANT ALL ON TABLE "public"."communication_events" TO "service_role";



GRANT ALL ON TABLE "public"."communication_festivals" TO "anon";
GRANT ALL ON TABLE "public"."communication_festivals" TO "authenticated";
GRANT ALL ON TABLE "public"."communication_festivals" TO "service_role";



GRANT ALL ON TABLE "public"."contact_identities" TO "anon";
GRANT ALL ON TABLE "public"."contact_identities" TO "authenticated";
GRANT ALL ON TABLE "public"."contact_identities" TO "service_role";



GRANT ALL ON TABLE "public"."contact_identities_bak_20260726" TO "anon";
GRANT ALL ON TABLE "public"."contact_identities_bak_20260726" TO "authenticated";
GRANT ALL ON TABLE "public"."contact_identities_bak_20260726" TO "service_role";



GRANT ALL ON TABLE "public"."contact_reveal_log" TO "anon";
GRANT ALL ON TABLE "public"."contact_reveal_log" TO "authenticated";
GRANT ALL ON TABLE "public"."contact_reveal_log" TO "service_role";



GRANT ALL ON TABLE "public"."conversations" TO "anon";
GRANT ALL ON TABLE "public"."conversations" TO "authenticated";
GRANT ALL ON TABLE "public"."conversations" TO "service_role";



GRANT ALL ON TABLE "public"."countries" TO "anon";
GRANT ALL ON TABLE "public"."countries" TO "authenticated";
GRANT ALL ON TABLE "public"."countries" TO "service_role";



GRANT ALL ON TABLE "public"."document_checklist_rules" TO "anon";
GRANT ALL ON TABLE "public"."document_checklist_rules" TO "authenticated";
GRANT ALL ON TABLE "public"."document_checklist_rules" TO "service_role";



GRANT ALL ON TABLE "public"."document_checklists" TO "anon";
GRANT ALL ON TABLE "public"."document_checklists" TO "authenticated";
GRANT ALL ON TABLE "public"."document_checklists" TO "service_role";



GRANT ALL ON TABLE "public"."entity_notes" TO "anon";
GRANT ALL ON TABLE "public"."entity_notes" TO "authenticated";
GRANT ALL ON TABLE "public"."entity_notes" TO "service_role";



GRANT ALL ON TABLE "public"."expiry_alert_rules" TO "anon";
GRANT ALL ON TABLE "public"."expiry_alert_rules" TO "authenticated";
GRANT ALL ON TABLE "public"."expiry_alert_rules" TO "service_role";



GRANT ALL ON TABLE "public"."expiry_items" TO "anon";
GRANT ALL ON TABLE "public"."expiry_items" TO "authenticated";
GRANT ALL ON TABLE "public"."expiry_items" TO "service_role";



GRANT ALL ON TABLE "public"."family_members" TO "anon";
GRANT ALL ON TABLE "public"."family_members" TO "authenticated";
GRANT ALL ON TABLE "public"."family_members" TO "service_role";



GRANT ALL ON TABLE "public"."family_units" TO "anon";
GRANT ALL ON TABLE "public"."family_units" TO "authenticated";
GRANT ALL ON TABLE "public"."family_units" TO "service_role";



GRANT ALL ON TABLE "public"."finance_entries" TO "anon";
GRANT ALL ON TABLE "public"."finance_entries" TO "authenticated";
GRANT ALL ON TABLE "public"."finance_entries" TO "service_role";



GRANT ALL ON TABLE "public"."integrations_config" TO "anon";
GRANT ALL ON TABLE "public"."integrations_config" TO "authenticated";
GRANT ALL ON TABLE "public"."integrations_config" TO "service_role";



GRANT ALL ON TABLE "public"."invoices" TO "anon";
GRANT ALL ON TABLE "public"."invoices" TO "authenticated";
GRANT ALL ON TABLE "public"."invoices" TO "service_role";



GRANT ALL ON TABLE "public"."ircc_emails" TO "anon";
GRANT ALL ON TABLE "public"."ircc_emails" TO "authenticated";
GRANT ALL ON TABLE "public"."ircc_emails" TO "service_role";



GRANT ALL ON TABLE "public"."lead_deletions" TO "anon";
GRANT ALL ON TABLE "public"."lead_deletions" TO "authenticated";
GRANT ALL ON TABLE "public"."lead_deletions" TO "service_role";



GRANT ALL ON TABLE "public"."lead_nurture_targets" TO "anon";
GRANT ALL ON TABLE "public"."lead_nurture_targets" TO "authenticated";
GRANT ALL ON TABLE "public"."lead_nurture_targets" TO "service_role";



GRANT ALL ON TABLE "public"."lead_routing_rules" TO "anon";
GRANT ALL ON TABLE "public"."lead_routing_rules" TO "authenticated";
GRANT ALL ON TABLE "public"."lead_routing_rules" TO "service_role";



GRANT ALL ON TABLE "public"."lead_sources" TO "anon";
GRANT ALL ON TABLE "public"."lead_sources" TO "authenticated";
GRANT ALL ON TABLE "public"."lead_sources" TO "service_role";



GRANT ALL ON TABLE "public"."leads" TO "anon";
GRANT ALL ON TABLE "public"."leads" TO "authenticated";
GRANT ALL ON TABLE "public"."leads" TO "service_role";



GRANT ALL ON TABLE "public"."messages" TO "anon";
GRANT ALL ON TABLE "public"."messages" TO "authenticated";
GRANT ALL ON TABLE "public"."messages" TO "service_role";



GRANT ALL ON TABLE "public"."staff_profiles" TO "anon";
GRANT ALL ON TABLE "public"."staff_profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."staff_profiles" TO "service_role";



GRANT ALL ON TABLE "public"."tasks" TO "anon";
GRANT ALL ON TABLE "public"."tasks" TO "authenticated";
GRANT ALL ON TABLE "public"."tasks" TO "service_role";



GRANT ALL ON TABLE "public"."mv_cases_at_risk" TO "anon";
GRANT ALL ON TABLE "public"."mv_cases_at_risk" TO "authenticated";
GRANT ALL ON TABLE "public"."mv_cases_at_risk" TO "service_role";



GRANT ALL ON TABLE "public"."payments" TO "anon";
GRANT ALL ON TABLE "public"."payments" TO "authenticated";
GRANT ALL ON TABLE "public"."payments" TO "service_role";



GRANT ALL ON TABLE "public"."mv_dashboard_kpis" TO "anon";
GRANT ALL ON TABLE "public"."mv_dashboard_kpis" TO "authenticated";
GRANT ALL ON TABLE "public"."mv_dashboard_kpis" TO "service_role";



GRANT ALL ON TABLE "public"."office_holidays" TO "anon";
GRANT ALL ON TABLE "public"."office_holidays" TO "authenticated";
GRANT ALL ON TABLE "public"."office_holidays" TO "service_role";



GRANT ALL ON TABLE "public"."office_hours_config" TO "anon";
GRANT ALL ON TABLE "public"."office_hours_config" TO "authenticated";
GRANT ALL ON TABLE "public"."office_hours_config" TO "service_role";



GRANT ALL ON TABLE "public"."office_settings" TO "anon";
GRANT ALL ON TABLE "public"."office_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."office_settings" TO "service_role";



GRANT ALL ON TABLE "public"."orgs" TO "anon";
GRANT ALL ON TABLE "public"."orgs" TO "authenticated";
GRANT ALL ON TABLE "public"."orgs" TO "service_role";



GRANT ALL ON TABLE "public"."outbound_messages" TO "anon";
GRANT ALL ON TABLE "public"."outbound_messages" TO "authenticated";
GRANT ALL ON TABLE "public"."outbound_messages" TO "service_role";



GRANT ALL ON TABLE "public"."program_eligibility_rules" TO "anon";
GRANT ALL ON TABLE "public"."program_eligibility_rules" TO "authenticated";
GRANT ALL ON TABLE "public"."program_eligibility_rules" TO "service_role";



GRANT ALL ON TABLE "public"."prospective_applications" TO "anon";
GRANT ALL ON TABLE "public"."prospective_applications" TO "authenticated";
GRANT ALL ON TABLE "public"."prospective_applications" TO "service_role";



GRANT ALL ON TABLE "public"."questionnaire_questions" TO "anon";
GRANT ALL ON TABLE "public"."questionnaire_questions" TO "authenticated";
GRANT ALL ON TABLE "public"."questionnaire_questions" TO "service_role";



GRANT ALL ON TABLE "public"."questionnaire_response_items" TO "anon";
GRANT ALL ON TABLE "public"."questionnaire_response_items" TO "authenticated";
GRANT ALL ON TABLE "public"."questionnaire_response_items" TO "service_role";



GRANT ALL ON TABLE "public"."questionnaire_responses" TO "anon";
GRANT ALL ON TABLE "public"."questionnaire_responses" TO "authenticated";
GRANT ALL ON TABLE "public"."questionnaire_responses" TO "service_role";



GRANT ALL ON TABLE "public"."questionnaire_sections" TO "anon";
GRANT ALL ON TABLE "public"."questionnaire_sections" TO "authenticated";
GRANT ALL ON TABLE "public"."questionnaire_sections" TO "service_role";



GRANT ALL ON TABLE "public"."questionnaire_templates" TO "anon";
GRANT ALL ON TABLE "public"."questionnaire_templates" TO "authenticated";
GRANT ALL ON TABLE "public"."questionnaire_templates" TO "service_role";



GRANT ALL ON TABLE "public"."referral_partners" TO "anon";
GRANT ALL ON TABLE "public"."referral_partners" TO "authenticated";
GRANT ALL ON TABLE "public"."referral_partners" TO "service_role";



GRANT ALL ON TABLE "public"."sla_rules" TO "anon";
GRANT ALL ON TABLE "public"."sla_rules" TO "authenticated";
GRANT ALL ON TABLE "public"."sla_rules" TO "service_role";



GRANT ALL ON TABLE "public"."step_conditions" TO "anon";
GRANT ALL ON TABLE "public"."step_conditions" TO "authenticated";
GRANT ALL ON TABLE "public"."step_conditions" TO "service_role";



GRANT ALL ON TABLE "public"."step_template_edits" TO "anon";
GRANT ALL ON TABLE "public"."step_template_edits" TO "authenticated";
GRANT ALL ON TABLE "public"."step_template_edits" TO "service_role";



GRANT ALL ON TABLE "public"."step_templates" TO "anon";
GRANT ALL ON TABLE "public"."step_templates" TO "authenticated";
GRANT ALL ON TABLE "public"."step_templates" TO "service_role";



GRANT ALL ON TABLE "public"."task_statuses_ref" TO "anon";
GRANT ALL ON TABLE "public"."task_statuses_ref" TO "authenticated";
GRANT ALL ON TABLE "public"."task_statuses_ref" TO "service_role";



GRANT ALL ON TABLE "public"."trigger_events" TO "anon";
GRANT ALL ON TABLE "public"."trigger_events" TO "authenticated";
GRANT ALL ON TABLE "public"."trigger_events" TO "service_role";



GRANT ALL ON TABLE "public"."upsell_triggers" TO "anon";
GRANT ALL ON TABLE "public"."upsell_triggers" TO "authenticated";
GRANT ALL ON TABLE "public"."upsell_triggers" TO "service_role";



GRANT ALL ON TABLE "public"."visa_types" TO "anon";
GRANT ALL ON TABLE "public"."visa_types" TO "authenticated";
GRANT ALL ON TABLE "public"."visa_types" TO "service_role";



GRANT ALL ON TABLE "public"."v_application_family_chain" TO "anon";
GRANT ALL ON TABLE "public"."v_application_family_chain" TO "authenticated";
GRANT ALL ON TABLE "public"."v_application_family_chain" TO "service_role";



GRANT ALL ON TABLE "public"."v_assessment_answers" TO "anon";
GRANT ALL ON TABLE "public"."v_assessment_answers" TO "authenticated";
GRANT ALL ON TABLE "public"."v_assessment_answers" TO "service_role";



GRANT ALL ON TABLE "public"."v_assessment_summary" TO "anon";
GRANT ALL ON TABLE "public"."v_assessment_summary" TO "authenticated";
GRANT ALL ON TABLE "public"."v_assessment_summary" TO "service_role";



GRANT ALL ON TABLE "public"."v_branch_health" TO "anon";
GRANT ALL ON TABLE "public"."v_branch_health" TO "authenticated";
GRANT ALL ON TABLE "public"."v_branch_health" TO "service_role";



GRANT ALL ON TABLE "public"."v_case_financials" TO "anon";
GRANT ALL ON TABLE "public"."v_case_financials" TO "authenticated";
GRANT ALL ON TABLE "public"."v_case_financials" TO "service_role";



GRANT ALL ON TABLE "public"."v_case_notes" TO "anon";
GRANT ALL ON TABLE "public"."v_case_notes" TO "authenticated";
GRANT ALL ON TABLE "public"."v_case_notes" TO "service_role";



GRANT ALL ON TABLE "public"."v_case_timeline" TO "anon";
GRANT ALL ON TABLE "public"."v_case_timeline" TO "authenticated";
GRANT ALL ON TABLE "public"."v_case_timeline" TO "service_role";



GRANT ALL ON TABLE "public"."v_cases_masked" TO "anon";
GRANT ALL ON TABLE "public"."v_cases_masked" TO "authenticated";
GRANT ALL ON TABLE "public"."v_cases_masked" TO "service_role";



GRANT ALL ON TABLE "public"."v_client_family_chain" TO "anon";
GRANT ALL ON TABLE "public"."v_client_family_chain" TO "authenticated";
GRANT ALL ON TABLE "public"."v_client_family_chain" TO "service_role";



GRANT ALL ON TABLE "public"."v_clients_accounts" TO "anon";
GRANT ALL ON TABLE "public"."v_clients_accounts" TO "authenticated";
GRANT ALL ON TABLE "public"."v_clients_accounts" TO "service_role";



GRANT ALL ON TABLE "public"."v_contact_reveal_anomalies" TO "anon";
GRANT ALL ON TABLE "public"."v_contact_reveal_anomalies" TO "authenticated";
GRANT ALL ON TABLE "public"."v_contact_reveal_anomalies" TO "service_role";



GRANT ALL ON TABLE "public"."v_counselor_performance" TO "anon";
GRANT ALL ON TABLE "public"."v_counselor_performance" TO "authenticated";
GRANT ALL ON TABLE "public"."v_counselor_performance" TO "service_role";



GRANT ALL ON TABLE "public"."v_followup_integrity" TO "anon";
GRANT ALL ON TABLE "public"."v_followup_integrity" TO "authenticated";
GRANT ALL ON TABLE "public"."v_followup_integrity" TO "service_role";



GRANT ALL ON TABLE "public"."v_followup_integrity_by_staff" TO "anon";
GRANT ALL ON TABLE "public"."v_followup_integrity_by_staff" TO "authenticated";
GRANT ALL ON TABLE "public"."v_followup_integrity_by_staff" TO "service_role";



GRANT ALL ON TABLE "public"."v_lead_deletions" TO "anon";
GRANT ALL ON TABLE "public"."v_lead_deletions" TO "authenticated";
GRANT ALL ON TABLE "public"."v_lead_deletions" TO "service_role";



GRANT ALL ON TABLE "public"."v_lead_notes" TO "anon";
GRANT ALL ON TABLE "public"."v_lead_notes" TO "authenticated";
GRANT ALL ON TABLE "public"."v_lead_notes" TO "service_role";



GRANT ALL ON TABLE "public"."v_lead_overview" TO "anon";
GRANT ALL ON TABLE "public"."v_lead_overview" TO "authenticated";
GRANT ALL ON TABLE "public"."v_lead_overview" TO "service_role";



GRANT ALL ON TABLE "public"."v_lead_timeline" TO "anon";
GRANT ALL ON TABLE "public"."v_lead_timeline" TO "authenticated";
GRANT ALL ON TABLE "public"."v_lead_timeline" TO "service_role";



GRANT ALL ON TABLE "public"."v_recent_chain_firings" TO "anon";
GRANT ALL ON TABLE "public"."v_recent_chain_firings" TO "authenticated";
GRANT ALL ON TABLE "public"."v_recent_chain_firings" TO "service_role";



GRANT ALL ON TABLE "public"."v_stage_events" TO "anon";
GRANT ALL ON TABLE "public"."v_stage_events" TO "authenticated";
GRANT ALL ON TABLE "public"."v_stage_events" TO "service_role";



GRANT ALL ON TABLE "public"."v_top_family_units" TO "anon";
GRANT ALL ON TABLE "public"."v_top_family_units" TO "authenticated";
GRANT ALL ON TABLE "public"."v_top_family_units" TO "service_role";



GRANT ALL ON TABLE "public"."visa_categories" TO "anon";
GRANT ALL ON TABLE "public"."visa_categories" TO "authenticated";
GRANT ALL ON TABLE "public"."visa_categories" TO "service_role";



GRANT ALL ON TABLE "public"."visa_sub_types" TO "anon";
GRANT ALL ON TABLE "public"."visa_sub_types" TO "authenticated";
GRANT ALL ON TABLE "public"."visa_sub_types" TO "service_role";



GRANT ALL ON TABLE "public"."wa_templates" TO "anon";
GRANT ALL ON TABLE "public"."wa_templates" TO "authenticated";
GRANT ALL ON TABLE "public"."wa_templates" TO "service_role";



GRANT ALL ON TABLE "public"."wa_webhook_events" TO "anon";
GRANT ALL ON TABLE "public"."wa_webhook_events" TO "authenticated";
GRANT ALL ON TABLE "public"."wa_webhook_events" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































