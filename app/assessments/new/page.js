'use client';
import {useState, useEffect, useCallback, useMemo} from 'react';
import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {useStore} from '../../../components/Store';
import {shouldAsk} from '../../../components/AskWhen';

const VERDICT = {
  eligible: ['ELIGIBLE', 't-ok'],
  potential: ['POTENTIAL', 't-acc'],
  not_eligible: ['NOT ELIGIBLE', 't-mute'],
};

export default function NewAssessment() {
  const {leads, leadsState, loadAssessmentForm, assess, saveAssessment} = useStore();
  const router = useRouter();
  const [form, setForm] = useState({questions: [], purposes: []});
  const [state, setState] = useState('loading');
  const [error, setError] = useState(null);
  const [leadRef, setLeadRef] = useState('');
  const [answers, setAnswers] = useState({purpose: ''});
  const [routes, setRoutes] = useState([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(null);
  const [note, setNote] = useState('');

  useEffect(() => {
    (async () => {
      try { setForm(await loadAssessmentForm()); setState('ready'); }
      catch (e) { setError(e.message); setState('error'); }
    })();
  }, [loadAssessmentForm]);

  // Only ask what the conditions say to ask, evaluated against what is answered so far.
  const visible = useMemo(
    () => form.questions.filter(q => shouldAsk(q, answers)),
    [form.questions, answers]);

  const sections = useMemo(() => {
    const out = [];
    visible.forEach(q => {
      const last = out[out.length - 1];
      if (last && last.name === q.section) last.items.push(q);
      else out.push({name: q.section, items: [q]});
    });
    return out;
  }, [visible]);

  // Re-run the rules shortly after typing stops.
  const run = useCallback(async (a) => {
    try { setRoutes(await assess(a)); } catch { /* the verdict panel just stays as it was */ }
  }, [assess]);

  useEffect(() => {
    const t = setTimeout(() => run(answers), 350);
    return () => clearTimeout(t);
  }, [answers, run]);

  function set(key, value) { setAnswers(a => Object.assign({}, a, {[key]: value})); }

  const eligible = routes.filter(r => r.verdict === 'eligible');
  const potential = routes.filter(r => r.verdict === 'potential');
  const blocked = routes.filter(r => r.verdict === 'not_eligible');
  const anyUnconfirmed = routes.some(r => r.confirmed === false);

  async function save() {
    if (!leadRef) { setError('Choose the lead this assessment belongs to.'); return; }
    setSaving(true); setError(null);
    try { setSaved(await saveAssessment(leadRef, answers, note || null)); }
    catch (e) { setError(e.message); }
    finally { setSaving(false); }
  }

  if (state === 'loading') return <div className="page"><div className="empty">Loading the question set…</div></div>;

  if (saved) return (<SavedView saved={saved} leadRef={leadRef} router={router}/>);

  return (<div className="page">
    <div className="phead"><div><h1>New assessment</h1>
      <p className="sub">Answer what applies. The verdict updates as you go, and every route shows the test it turned on.</p></div></div>

    {error ? <div className="advice" style={{borderLeftColor: 'var(--bad)'}}>
      <div className="lbl" style={{color: 'var(--bad)'}}>Problem</div><p>{error}</p></div> : null}

    <div className="grid g2" style={{alignItems: 'start'}}>
      <div>
        <div className="card" style={{marginBottom: 14}}><div className="card-h"><h2>Who this is for</h2></div>
          <div className="card-b"><div className="form">
            <div className="fld"><label htmlFor="lead">Lead</label>
              <select id="lead" value={leadRef} onChange={e => setLeadRef(e.target.value)}>
                <option value="">{leadsState === 'ready' ? 'Choose a lead…' : 'Loading leads…'}</option>
                {leads.map(l => <option key={l.id} value={l.id}>LEAD-{l.id} · {l.name}</option>)}
              </select></div>
            <div className="fld"><label htmlFor="purpose">Purpose</label>
              <select id="purpose" value={answers.purpose || ''} onChange={e => set('purpose', e.target.value)}>
                <option value="">Choose…</option>
                {form.purposes.map(p => <option key={p}>{p}</option>)}</select></div>
          </div>
          <p className="note">Purpose decides which questions are asked at all — it is the first thing the
            conditions read.</p></div></div>

        {sections.map(sec => <div className="card" key={sec.name} style={{marginBottom: 14}}>
          <div className="card-h"><h2>{sec.name}</h2><span className="spacer"/>
            <span className="n mono">{sec.items.length}</span></div>
          <div className="card-b"><div className="form">
            {sec.items.map(q => <div className="fld" key={q.key}>
              <label htmlFor={q.key}>{q.prompt}{q.mandatory ? ' *' : ''}</label>
              {q.type === 'select'
                ? <select id={q.key} value={answers[q.key] || ''} onChange={e => set(q.key, e.target.value)}>
                    <option value="">Choose…</option>
                    {(q.options || []).map(o => <option key={o}>{o}</option>)}</select>
                : q.type === 'yesno'
                ? <select id={q.key} value={answers[q.key] || ''} onChange={e => set(q.key, e.target.value)}>
                    <option value="">Choose…</option><option>Yes</option><option>No</option></select>
                : <input id={q.key} type={q.type === 'number' ? 'number' : q.type === 'date' ? 'date' : 'text'}
                    value={answers[q.key] || ''} onChange={e => set(q.key, e.target.value)}/>}
              {q.why ? <div className="hint">{q.why}</div> : null}
            </div>)}
          </div></div></div>)}
      </div>

      <div>
        <div className="card" style={{marginBottom: 14}}>
          <div className="card-h"><h2>Verdict</h2><span className="spacer"/>
            <span className="n mono">{visible.length} of {form.questions.length} asked</span></div>
          <div className="card-b">
            {!routes.length ? <div className="empty">Answer something to see the routes.</div> : <>
              <div style={{display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12}}>
                <span className="tag t-ok">{eligible.length} ELIGIBLE</span>
                <span className="tag t-acc">{potential.length} POTENTIAL</span>
                <span className="tag t-mute">{blocked.length} NOT ELIGIBLE</span>
              </div>
              {anyUnconfirmed ? <p className="note" style={{marginTop: 0}}>
                Thresholds shown are the workbook placeholders. Nothing here has been confirmed
                against the authority yet.</p> : null}
              {eligible.concat(potential).map(r => {
                const [text, tag] = VERDICT[r.verdict];
                return (<div key={r.code} style={{borderTop: '1px solid var(--line)', padding: '10px 0'}}>
                  <div style={{display: 'flex', gap: 8, alignItems: 'baseline'}}>
                    <b style={{fontSize: 13.5}}>{r.name}</b><span className="spacer"/>
                    <span className={'tag ' + tag}>{text}</span></div>
                  <div className="mono" style={{fontSize: 11, color: 'var(--ink3)', margin: '3px 0 6px'}}>
                    {r.family} · {r.version}</div>
                  {(r.tests || []).map(t => <div key={t.fact} style={{fontSize: 12.5, color: 'var(--ink2)'}}>
                    <span className="mono" style={{
                      color: t.verdict === 'pass' ? 'var(--ok)' : t.verdict === 'fail' ? 'var(--bad)' : 'var(--ink3)'}}>
                      {t.verdict === 'pass' ? '✓' : t.verdict === 'fail' ? '✕' : '?'}</span>{' '}
                    {t.needs}</div>)}
                </div>);
              })}
            </>}
          </div></div>

        {blocked.length ? <div className="card" style={{marginBottom: 14}}>
          <div className="card-h"><h2>Ruled out, and why</h2></div><div className="card-b">
          {blocked.map(r => <div key={r.code} style={{borderTop: '1px solid var(--line)', padding: '8px 0'}}>
            <b style={{fontSize: 13}}>{r.name}</b>
            {(r.tests || []).filter(t => t.verdict === 'fail').map(t =>
              <div key={t.fact} style={{fontSize: 12.5, color: 'var(--ink2)'}}>✕ {t.needs}</div>)}
          </div>)}</div></div> : null}

        {eligible.length ? <div className="card" style={{marginBottom: 14}}>
          <div className="card-h"><h2>Documents to request</h2><span className="spacer"/>
            <span className="n mono">{new Set(eligible.flatMap(r => r.documents || [])).size} distinct</span></div>
          <div className="card-b">
            {[...new Set(eligible.flatMap(r => r.documents || []))].map(d =>
              <div key={d} style={{fontSize: 12.5, color: 'var(--ink2)'}}>· {d}</div>)}
            <p className="note">Taken from the requirements on the eligible routes, deduplicated.</p>
          </div></div> : null}

        <div className="card"><div className="card-h"><h2>Record it</h2></div><div className="card-b">
          <div className="fld"><label htmlFor="n">Note for the file</label>
            <textarea id="n" rows={3} value={note} onChange={e => setNote(e.target.value)}
              placeholder="Anything the verdict does not capture."/></div>
          <div style={{marginTop: 10, display: 'flex', gap: 8}}>
            <button className="tbtn pri" onClick={save} disabled={saving || !leadRef}>
              {saving ? 'Saving…' : 'Save the assessment'}</button>
            <Link className="tbtn" href="/assessments">Cancel</Link></div>
          <p className="note">Saves the answers, the verdict and the routes against the lead, and puts it on
            the lead&rsquo;s timeline.</p>
        </div></div>
      </div>
    </div>
  </div>);
}

// After saving: the verdict, and the document plan the eligible routes produce.
// The plan comes back from the database, not from a list in this file.
function SavedView({saved, leadRef, router}) {
  const {loadDocumentPlan, requestDocuments} = useStore();
  const [plan, setPlan] = useState(null);
  const [picked, setPicked] = useState({});
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const p = await loadDocumentPlan(saved.ref);
        setPlan(p);
        const pre = {};
        (p.items || []).forEach(i => { if (i.mandatory && !i.requested) pre[i.requirement_id] = true; });
        setPicked(pre);
      } catch (e) { setMsg(e.message); }
    })();
  }, [saved.ref, loadDocumentPlan]);

  const ids = Object.keys(picked).filter(k => picked[k]);

  async function send() {
    setBusy(true); setMsg(null);
    try {
      const res = await requestDocuments(saved.ref, ids);
      setPlan(res.plan);
      setPicked({});
      setMsg(res.created + ' request(s) raised, with their due dates and chase schedule.');
    } catch (e) { setMsg(e.message); }
    finally { setBusy(false); }
  }

  const eligible = (saved.routes || []).filter(r => r.verdict === 'eligible');

  return (<div className="page">
    <div className="phead"><div><span className="tag t-ok">ASSESSMENT SAVED</span>
      <h1 style={{marginTop: 7}}>{saved.ref}</h1>
      <p className="sub">Result: {saved.label} · {eligible.length} route(s) eligible</p></div>
      <span className="spacer"/>
      <Link className="tbtn" href="/documents">Documents</Link>
      <button className="tbtn pri" onClick={() => router.push('/leads/' + leadRef)}>Open the lead</button></div>

    {saved.confirmed === false ? <div className="advice" style={{borderLeftColor: 'var(--warn)'}}>
      <div className="lbl" style={{color: 'var(--warn)'}}>Recorded as “needs review”</div>
      <p>The routes came out eligible, but every threshold they were judged against is still the
        workbook placeholder. Confirm those against the authority before this is given to the client as an answer.</p>
      <Link className="tbtn" href="/control-centre/rules" style={{marginTop: 8}}>Confirm the thresholds</Link>
    </div> : null}

    <div className="grid g2" style={{alignItems: 'start'}}>
      <div className="card"><div className="card-h"><h2>Eligible routes</h2></div>
        <div className="scrollx"><table className="tbl"><tbody>
          {eligible.map(r => <tr key={r.code}><td className="k">{r.name}</td>
            <td>{r.family} · {r.version}</td>
            <td><span className="tag t-ok">ELIGIBLE</span></td></tr>)}
          {!eligible.length ? <tr><td><div className="empty">No route came out eligible.</div></td></tr> : null}
        </tbody></table></div></div>

      <div className="card"><div className="card-h"><h2>Documents to request</h2><span className="spacer"/>
        <span className="n mono">{ids.length} selected</span></div>
        <div className="card-b">
          {msg ? <p className="note" style={{marginTop: 0}}>{msg}</p> : null}
          {!plan ? <div className="empty">Working out the plan…</div>
            : !(plan.items || []).length ? <div className="empty">No requirements on the eligible routes.</div>
            : <>
              {plan.items.map(i => <label key={i.requirement_id}
                style={{display: 'flex', gap: 9, alignItems: 'flex-start', padding: '7px 0',
                  borderTop: '1px solid var(--line)', cursor: i.requested ? 'default' : 'pointer'}}>
                <input type="checkbox" disabled={!!i.requested} checked={!!picked[i.requirement_id]}
                  onChange={e => setPicked(p => Object.assign({}, p, {[i.requirement_id]: e.target.checked}))}
                  style={{marginTop: 3}}/>
                <span>
                  <b style={{fontSize: 13}}>{i.name}</b>
                  {i.mandatory ? <span className="tag t-warn" style={{marginLeft: 6}}>BLOCKING</span> : null}
                  {i.requested ? <span className="tag t-ok" style={{marginLeft: 6}}>{i.status.toUpperCase()}</span> : null}
                  <div style={{fontSize: 12, color: 'var(--ink2)'}}>{i.why}</div>
                  <div className="mono" style={{fontSize: 11, color: 'var(--ink3)'}}>
                    due in {i.due_days} days · chased {(i.reminders || []).join(' and ')} days before
                  </div>
                </span></label>)}
              <div style={{marginTop: 12}}>
                <button className="tbtn pri" disabled={busy || !ids.length} onClick={send}>
                  {busy ? 'Raising…' : 'Request the ticked documents'}</button></div>
              <p className="note">Each one gets a due date and a chase schedule from its requirement.
                Nothing is sent to the client — there is no messaging channel wired yet.</p>
            </>}
        </div></div>
    </div>
  </div>);
}
