'use client';
import {createContext, useContext, useState, useEffect, useCallback} from 'react';
import {supabase, configured} from '../lib/supabase';

const Ctx = createContext(null);

/**
 * Leads are real. Everything a lead screen shows now comes from the database
 * through fn_leads_board / fn_lead, and every change goes back through
 * fn_create_lead / fn_lead_event. Nothing here keeps a lead in memory and
 * pretends it was saved.
 *
 * Every screen reads the database. There is no seeded content anywhere: a screen
 * with nothing to show says which table is empty rather than inventing rows.
 */
export function StoreProvider({children}) {
  const [leads, setLeads] = useState([]);
  const [leadsState, setLeadsState] = useState('loading'); // loading | ready | error
  const [leadsError, setLeadsError] = useState(null);
  const [refs, setRefs] = useState({countries: [], purposes: [], sources: []});

  const reload = useCallback(async () => {
    if (!configured) {
      setLeadsState('error');
      setLeadsError('This deployment has no Supabase configuration.');
      return;
    }
    setLeadsState('loading');
    setLeadsError(null);
    const [board, refsRes] = await Promise.all([
      supabase.rpc('fn_leads_board'),
      supabase.rpc('fn_lead_refs'),
    ]);
    if (board.error) {
      setLeadsError(board.error.message);
      setLeadsState('error');
      return;
    }
    setLeads(Array.isArray(board.data) ? board.data : []);
    if (!refsRes.error && refsRes.data) {
      setRefs({
        countries: refsRes.data.countries ?? [],
        purposes: refsRes.data.purposes ?? [],
        sources: refsRes.data.sources ?? [],
      });
    }
    setLeadsState('ready');
  }, []);

  useEffect(() => { reload(); }, [reload]);

  // Create. Throws with the database's own sentence so the form can show it —
  // "that person already has an open lead" is a real answer, not a failure.
  async function addLead(form) {
    const {data, error} = await supabase.rpc('fn_create_lead', {p: form});
    if (error) throw new Error(error.message);
    setLeads(ls => [data].concat(ls.filter(l => l.id !== data.id)));
    return data;
  }

  // One lead with its timeline. The board rows are deliberately light.
  async function loadLead(ref) {
    const {data, error} = await supabase.rpc('fn_lead', {p_ref: ref});
    if (error) throw new Error(error.message);
    if (!data) throw new Error('That lead does not exist, or you cannot see it.');
    return data;
  }

  // Append to the timeline, optionally moving the stage or the next action.
  // stage must be a lead_stage value: new, contacting, assessment, qualified,
  // proposal, decision_pending, converted, nurturing, closed_lost.
  async function logEvent(ref, {action, summary, stage = null, next = null, dueHours = 24}) {
    const {data, error} = await supabase.rpc('fn_lead_event', {
      p_ref: ref, p_action: action, p_summary: summary ?? null,
      p_stage: stage, p_next: next, p_next_due_hours: dueHours,
    });
    if (error) throw new Error(error.message);
    setLeads(ls => ls.map(l => l.id === data.id ? Object.assign({}, l, {
      stage: data.stage, stageTag: data.stageTag, next: data.next, reason: data.reason,
    }) : l));
    return data;
  }

  // --- assessment ------------------------------------------------------
  async function loadAssessmentForm() {
    const {data, error} = await supabase.rpc('fn_assessment_form');
    if (error) throw new Error(error.message);
    return {questions: data?.questions ?? [], purposes: data?.purposes ?? []};
  }

  // Runs the rules without writing anything, so the verdict can update as the
  // counsellor types.
  async function assess(answers) {
    const {data, error} = await supabase.rpc('fn_assess', {p_answers: answers});
    if (error) throw new Error(error.message);
    return data ?? [];
  }

  async function saveAssessment(leadRef, answers, note) {
    const {data, error} = await supabase.rpc('fn_assessment_save', {
      p_lead_ref: leadRef, p_answers: answers, p_note: note ?? null,
    });
    if (error) throw new Error(error.message);
    return data;
  }

  async function loadAssessments() {
    const {data, error} = await supabase.rpc('fn_assessments_board');
    if (error) throw new Error(error.message);
    return data ?? [];
  }

  // --- documents --------------------------------------------------------
  // A document request hangs off an assessment, never off a bare lead — the
  // schema refuses one without either an assessment or a matter.
  async function loadDocumentPlan(assessmentRef) {
    const {data, error} = await supabase.rpc('fn_document_plan', {p_ref: assessmentRef});
    if (error) throw new Error(error.message);
    return data ?? {items: [], routes: []};
  }

  async function requestDocuments(assessmentRef, requirementIds) {
    const {data, error} = await supabase.rpc('fn_documents_request', {
      p_ref: assessmentRef, p_requirement_ids: requirementIds,
    });
    if (error) throw new Error(error.message);
    return data;
  }

  async function loadDocuments() {
    const {data, error} = await supabase.rpc('fn_documents_board');
    if (error) throw new Error(error.message);
    return data ?? [];
  }

  async function documentDecision(docRef, decision, reason) {
    const {data, error} = await supabase.rpc('fn_document_decision', {
      p_doc_ref: docRef, p_decision: decision, p_reason: reason ?? null,
    });
    if (error) throw new Error(error.message);
    return data ?? [];
  }

  // Upload goes straight to Storage, then the database records what arrived.
  // The path is issued by the server so a file can only land in its own request's
  // folder — the browser never chooses where it writes.
  async function uploadDocument(docRef, file) {
    const {data: target, error: e1} = await supabase.rpc('fn_document_upload_path', {
      p_doc_ref: docRef, p_file_name: file.name,
    });
    if (e1) throw new Error(e1.message);

    const {error: e2} = await supabase.storage
      .from(target.bucket)
      .upload(target.path, file, {contentType: file.type || undefined, upsert: false});
    if (e2) throw new Error(e2.message);

    const {data, error: e3} = await supabase.rpc('fn_document_attach', {
      p_doc_ref: docRef, p_storage_path: target.path, p_file_name: file.name,
      p_mime: file.type || null, p_size: file.size,
    });
    if (e3) throw new Error(e3.message);
    return data;
  }

  async function documentFiles(docRef) {
    const {data, error} = await supabase.rpc('fn_document_files', {p_doc_ref: docRef});
    if (error) throw new Error(error.message);
    return data ?? [];
  }

  // The bucket is private; a link is signed on demand and expires.
  async function documentFileLink(path) {
    const {data, error} = await supabase.storage
      .from('client-documents').createSignedUrl(path, 120);
    if (error) throw new Error(error.message);
    return data.signedUrl;
  }

  // --- eligibility rules -------------------------------------------------
  async function loadRules() {
    const {data, error} = await supabase.rpc('fn_rules_board');
    if (error) throw new Error(error.message);
    return data ?? [];
  }

  async function loadPolicySources() {
    const {data, error} = await supabase.rpc('fn_policy_sources');
    if (error) throw new Error(error.message);
    return data ?? [];
  }

  // Activating is what lets the engine give a client a firm answer, so the
  // database refuses it without a source and a value — the form just relays that.
  async function verifyRule({code, value, url, title, publisher, quote, nextCheck, activate}) {
    const {data, error} = await supabase.rpc('fn_rule_verify', {
      p_code: code, p_value: value, p_url: url || null, p_title: title || null,
      p_publisher: publisher || null, p_quote: quote || null,
      p_next_check: nextCheck || null, p_activate: !!activate,
    });
    if (error) throw new Error(error.message);
    return data ?? [];
  }

  async function deactivateRule(code, reason) {
    const {data, error} = await supabase.rpc('fn_rule_deactivate', {p_code: code, p_reason: reason});
    if (error) throw new Error(error.message);
    return data ?? [];
  }

  // --- catalogue, stages, delete ------------------------------------------
  async function loadCatalogue() {
    const {data, error} = await supabase.rpc('fn_catalogue');
    if (error) throw new Error(error.message);
    return data ?? {};
  }

  // Move a lead to any stage on its pipeline. Skipping is allowed and is
  // recorded as a bypass with the stages it went past.
  async function moveLead(ref, {stage, reason, note, channel, outcome, followUpAt}) {
    const {data, error} = await supabase.rpc('fn_lead_move', {
      p_ref: ref, p_stage_code: stage,
      p_reason: reason || null, p_note: note || null,
      p_channel: channel || null, p_outcome: outcome || null,
      p_follow_up_at: followUpAt || null,
    });
    if (error) throw new Error(error.message);
    return data;
  }

  async function amOwner() {
    const {data, error} = await supabase.rpc('fn_am_owner');
    if (error) return false;
    return !!data;
  }

  // Permanent. The database refuses this for anybody but the owner.
  async function deleteLead(ref, reason) {
    const {data, error} = await supabase.rpc('fn_delete_lead', {p_ref: ref, p_reason: reason});
    if (error) throw new Error(error.message);
    setLeads(data?.board ?? []);
    return data;
  }

  // --- lead sources and referrals -----------------------------------------
  // A source can say it also needs a who: the client who sent them, or a partner.
  async function leadSourceOptions() {
    const {data, error} = await supabase.rpc('fn_lead_source_options');
    if (error) throw new Error(error.message);
    return data ?? [];
  }

  async function referralCandidates(kind, query) {
    const {data, error} = await supabase.rpc('fn_referral_candidates', {
      p_kind: kind, p_query: query || null,
    });
    if (error) throw new Error(error.message);
    return data ?? [];
  }

  async function setLeadReferral(ref, {person = null, partner = null}) {
    const {data, error} = await supabase.rpc('fn_lead_set_referral', {
      p_ref: ref, p_person: person, p_partner: partner,
    });
    if (error) throw new Error(error.message);
    return data;
  }

  // --- navigation counts and calendar ------------------------------------
  async function navCounts() {
    const {data, error} = await supabase.rpc('fn_nav_counts');
    if (error) return {};
    return data ?? {};
  }

  async function appointmentTypes() {
    const {data, error} = await supabase.rpc('fn_appointment_types');
    if (error) throw new Error(error.message);
    return data ?? [];
  }

  async function saveAppointmentType({name, kind, minutes, location, reminderHours}) {
    const {data, error} = await supabase.rpc('fn_appointment_type_save', {
      p_name: name, p_kind: kind, p_minutes: minutes,
      p_location: location || null, p_reminder_hours: reminderHours,
    });
    if (error) throw new Error(error.message);
    return data ?? [];
  }

  async function calendar(from, to) {
    const {data, error} = await supabase.rpc('fn_calendar', {p_from: from, p_to: to});
    if (error) throw new Error(error.message);
    return data ?? [];
  }

  async function bookAppointment({leadRef, typeId, startsAt, minutes, location, agenda}) {
    const {data, error} = await supabase.rpc('fn_appointment_book', {
      p_lead_ref: leadRef, p_type_id: typeId, p_starts_at: startsAt,
      p_minutes: minutes || null, p_location: location || null, p_agenda: agenda || null,
    });
    if (error) throw new Error(error.message);
    return data;
  }

  async function setAppointmentStatus(id, status, note) {
    const {data, error} = await supabase.rpc('fn_appointment_status', {
      p_id: id, p_status: status, p_note: note || null,
    });
    if (error) throw new Error(error.message);
    return data;
  }

  // Each of these reads one screen's data. They return the rows and the name of
  // the table behind them, so an empty screen can say what it is waiting for.
  const readers = {
    dashboard: 'fn_dashboard', clients: 'fn_clients_board', files: 'fn_files_board',
    money: 'fn_money_board', reports: 'fn_reports', hr: 'fn_hr_board',
    inbox: 'fn_inbox_board', settings: 'fn_settings',
  };
  async function read(screen) {
    const fn = readers[screen];
    if (!fn) throw new Error('No reader for ' + screen);
    const {data, error} = await supabase.rpc(fn);
    if (error) throw new Error(error.message);
    return data ?? {};
  }

  function findByPhone(phone) {
    const digits = String(phone || '').replace(/\D/g, '');
    if (!digits) return null;
    return leads.find(l => String(l.phone || '').replace(/\D/g, '') === digits) || null;
  }

  return <Ctx.Provider value={{
    leads, leadsState, leadsError, refs, reload,
    addLead, loadLead, logEvent, findByPhone,
    loadAssessmentForm, assess, saveAssessment, loadAssessments,
    loadDocumentPlan, requestDocuments, loadDocuments, documentDecision,
    uploadDocument, documentFiles, documentFileLink,
    loadRules, loadPolicySources, verifyRule, deactivateRule,
    loadCatalogue, moveLead, amOwner, deleteLead,
    leadSourceOptions, referralCandidates, setLeadReferral,
    read,
    navCounts, appointmentTypes, saveAppointmentType, calendar,
    bookAppointment, setAppointmentStatus,
  }}>{children}</Ctx.Provider>;
}

export function useStore() { return useContext(Ctx); }
