'use client';
import {use, useState, useEffect, useCallback} from 'react';
import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {useStore} from '../../../components/Store';
import {useToast} from '../../../components/ui';
import {BAND} from '../page';

export default function LeadDetail({params}) {
  const p = use(params);
  const router = useRouter();
  const {loadLead, logEvent, loadCatalogue, moveLead, amOwner, deleteLead} = useStore();
  const [lead, setLead] = useState(null);
  const [cat, setCat] = useState({stages: [], reasons: {}, checklist: []});
  const [state, setState] = useState('loading');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [toastNode, toast] = useToast();
  const [note, setNote] = useState('');
  const [owner, setOwner] = useState(false);

  // stage mover
  const [target, setTarget] = useState('');
  const [form, setForm] = useState({reason: '', note: '', channel: '', outcome: '', followUpAt: ''});
  const [picked, setPicked] = useState({});
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteReason, setDeleteReason] = useState('');

  const fetchAll = useCallback(async () => {
    setState('loading');
    try {
      const [l, c, o] = await Promise.all([loadLead(p.id), loadCatalogue(), amOwner()]);
      setLead(l); setCat(c); setOwner(o); setState('ready');
    } catch (e) { setError(e.message); setState('error'); }
  }, [p.id, loadLead, loadCatalogue, amOwner]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  async function act(payload, okTitle, okBody) {
    if (busy) return;
    setBusy(true);
    try { setLead(await logEvent(p.id, payload)); toast(okTitle, okBody); }
    catch (e) { toast('Not saved', e.message); }
    finally { setBusy(false); }
  }

  const stages = cat.stages || [];
  const current = stages.find(s => s.code === lead?.stageCode);
  const to = stages.find(s => s.code === target);
  const skipped = current && to && to.sequence > current.sequence + 1
    ? stages.filter(s => s.sequence > current.sequence && s.sequence < to.sequence) : [];

  async function move() {
    if (!to) return;
    setBusy(true);
    try {
      const next = await moveLead(p.id, {
        stage: to.code,
        reason: form.reason || (to.prompt === 'document_checklist'
          ? Object.keys(picked).filter(k => picked[k]).join(', ') : ''),
        note: form.note, channel: form.channel, outcome: form.outcome,
        followUpAt: form.followUpAt || null,
      });
      setLead(next);
      setTarget('');
      setForm({reason: '', note: '', channel: '', outcome: '', followUpAt: ''});
      setPicked({});
      toast('Moved to ' + to.name,
        skipped.length ? skipped.length + ' stage(s) were skipped and recorded as a bypass.'
                       : 'The timeline has it.');
    } catch (e) { toast('Not moved', e.message); }
    finally { setBusy(false); }
  }

  async function removeLead() {
    if (!deleteReason.trim()) { toast('Reason needed', 'Say why this lead is being deleted.'); return; }
    setBusy(true);
    try {
      const res = await deleteLead(p.id, deleteReason.trim());
      toast('Deleted', 'LEAD-' + p.id + ' and everything under it is gone.');
      router.push('/leads');
      return res;
    } catch (e) { toast('Not deleted', e.message); setBusy(false); }
  }

  if (state === 'loading') return <div className="page"><div className="empty">Loading the lead…</div></div>;
  if (state === 'error') return (<div className="page">
    <Link href="/leads" className="mini">&larr; All leads</Link>
    <div className="advice" style={{borderLeftColor: 'var(--bad)', marginTop: 12}}>
      <div className="lbl" style={{color: 'var(--bad)'}}>Could not open this lead</div>
      <p>{error}</p><button className="tbtn" onClick={fetchAll} style={{marginTop: 8}}>Try again</button>
    </div></div>);

  const [bandText, bandTag, bandWhy] = BAND[lead.band || 'unknown'] || BAND.unknown;

  return (<div className="page">
    <div className="phead"><div>
      <Link href="/leads" className="mini" style={{display: 'inline-block', marginBottom: 9}}>&larr; All leads</Link>
      <div style={{display: 'flex', gap: 7, alignItems: 'center'}}>
        <span className="tag t-mute mono">LEAD-{lead.id}</span>
        <span className={'tag ' + bandTag} title={bandWhy}>{bandText}</span></div>
      <h1 style={{marginTop: 7}}>{lead.name}</h1>
      <p className="sub">
        {[lead.category, lead.subcategory, lead.country].filter(Boolean).join(' · ')}
        {lead.phone ? ' · ' + lead.phone : ''} · owner {lead.owner}</p>
      <p className="sub" style={{marginTop: 2}}>
        {[lead.passport, lead.residence].filter(Boolean).join(' → ') || 'Passport and residence not recorded'}
        {' — '}{bandWhy.toLowerCase()}</p></div>
      <span className="spacer"/>
      <button className="tbtn" disabled={busy} onClick={() => act(
        {action: 'Call attempt logged', summary: 'No answer · outcome recorded'},
        'Call logged', 'An outcome is required on every attempt — “no answer” is an outcome.')}>
        Log a call</button>
    </div>

    <div className="stages" style={{marginBottom: 18}}>{stages.map(s =>
      <div key={s.code} className={'stg'
        + (current && s.sequence < current.sequence ? ' done' : '')
        + (current && s.sequence === current.sequence ? ' now' : '')}>
        <div className="n">{String(s.sequence).padStart(2, '0')}</div>
        <div className="l">{s.name}</div></div>)}</div>

    <div className="grid g2" style={{alignItems: 'start'}}>
      <div className="card"><div className="card-h"><h2>Move this lead</h2><span className="spacer"/>
        <span className="n mono">now at {lead.stage}</span></div>
        <div className="card-b">
          <div className="fld"><label htmlFor="to">Move to</label>
            <select id="to" value={target} onChange={e => { setTarget(e.target.value);
              setForm({reason: '', note: '', channel: '', outcome: '', followUpAt: ''}); }}>
              <option value="">Choose a stage…</option>
              {stages.filter(s => s.code !== lead.stageCode).map(s =>
                <option key={s.code} value={s.code}>{String(s.sequence).padStart(2, '0')} · {s.name}</option>)}
            </select></div>

          {to ? <div style={{marginTop: 10}}>
            <p style={{fontSize: 12.5, color: 'var(--ink2)', margin: '0 0 10px'}}>{to.description}</p>

            {skipped.length ? <div className="advice" style={{borderLeftColor: 'var(--warn)', marginBottom: 10}}>
              <div className="lbl" style={{color: 'var(--warn)'}}>This skips {skipped.length} stage{skipped.length > 1 ? 's' : ''}</div>
              <p>{skipped.map(s => s.name).join(', ')}. That is allowed, and it will be recorded
                as a bypass on the timeline with every stage named.</p>
            </div> : null}

            {to.prompt === 'channel' ? <>
              <div className="fld"><label>How did you reach them?</label>
                <select value={form.channel} onChange={e => setForm(f => ({...f, channel: e.target.value}))}>
                  <option value="">Choose…</option>
                  {(cat.reasons?.contact_channel || []).map(c => <option key={c}>{c}</option>)}</select></div>
              <div className="fld" style={{marginTop: 8}}><label>Outcome</label>
                <input value={form.outcome} placeholder="Answered · no answer · call back at 6"
                  onChange={e => setForm(f => ({...f, outcome: e.target.value}))}/></div>
            </> : null}

            {to.prompt === 'assessment_outcome' ? <>
              <div className="fld"><label>Result</label>
                <select value={form.outcome} onChange={e => setForm(f => ({...f, outcome: e.target.value}))}>
                  <option value="">Choose…</option>
                  <option>Positive</option><option>Negative</option></select></div>
              {form.outcome === 'Negative' ? <>
                <div className="fld" style={{marginTop: 8}}><label>Why not</label>
                  <select value={form.reason} onChange={e => setForm(f => ({...f, reason: e.target.value}))}>
                    <option value="">Choose…</option>
                    {(cat.reasons?.assessment_negative || []).map(r => <option key={r}>{r}</option>)}</select></div>
                <p className="note">A negative assessment usually ends the enquiry. Move to
                  <b> Withdrawn</b> afterwards if they are not going ahead.</p>
              </> : null}
            </> : null}

            {(to.requires_reason && to.prompt !== 'assessment_outcome') ? <div className="fld">
              <label>Reason</label>
              <select value={form.reason} onChange={e => setForm(f => ({...f, reason: e.target.value}))}>
                <option value="">Choose…</option>
                {(cat.reasons?.[to.reasons] || []).map(r => <option key={r}>{r}</option>)}</select></div> : null}

            {to.requires_task ? <div className="fld" style={{marginTop: 8}}>
              <label>Follow up on</label>
              <input type="datetime-local" value={form.followUpAt}
                onChange={e => setForm(f => ({...f, followUpAt: e.target.value}))}/></div> : null}

            {to.prompt === 'document_checklist' ? <div style={{marginTop: 8}}>
              <label style={{fontSize: 12, color: 'var(--ink2)'}}>Documents to ask for</label>
              <div style={{maxHeight: 230, overflowY: 'auto', border: '1px solid var(--line)',
                borderRadius: 8, padding: 8, marginTop: 5}}>
                {(cat.checklist || []).map(d => <label key={d.code}
                  style={{display: 'flex', gap: 8, alignItems: 'flex-start', padding: '3px 0', cursor: 'pointer'}}>
                  <input type="checkbox" checked={!!picked[d.name]} style={{marginTop: 3}}
                    onChange={e => setPicked(x => Object.assign({}, x, {[d.name]: e.target.checked}))}/>
                  <span><span style={{fontSize: 12.5}}>{d.name}</span>
                    {d.note ? <div style={{fontSize: 11, color: 'var(--ink3)'}}>{d.note}</div> : null}</span>
                </label>)}
              </div>
              <p className="note">A standing note asks for English translations of anything in
                another language. Selected documents are recorded on the timeline.</p>
            </div> : null}

            <div className="fld" style={{marginTop: 8}}><label>Note</label>
              <textarea rows={2} value={form.note}
                onChange={e => setForm(f => ({...f, note: e.target.value}))}
                placeholder="Anything worth keeping with this move."/></div>

            <div style={{marginTop: 10}}>
              <button className="tbtn pri" disabled={busy} onClick={move}>
                {busy ? 'Moving…' : skipped.length ? 'Bypass and move' : 'Move to ' + to.name}</button></div>
          </div> : <p className="note">Any stage can be reached from here. Skipping is allowed and
            recorded — nothing is silently jumped.</p>}
        </div></div>

      <div>
        <div className="card" style={{marginBottom: 14}}>
          <div className="card-h"><h2>Next action</h2><span className="spacer"/>
            <span className="n mono">{lead.next}</span></div><div className="card-b">
            <div style={{fontSize: 15, fontWeight: 600, marginBottom: 5}}>{lead.next}</div>
            <p style={{margin: 0, color: 'var(--ink2)', fontSize: 13}}>
              The schema will not let an open lead exist without a next action, a due date,
              an escalation rule and an owner.</p></div></div>

        <div className="card" style={{marginBottom: 14}}>
          <div className="card-h"><h2>Add a note</h2></div><div className="card-b">
          <div className="fld"><textarea value={note} onChange={e => setNote(e.target.value)} rows={3}
            placeholder="What did they say?"/></div>
          <div style={{marginTop: 10}}>
            <button className="tbtn pri" disabled={!note.trim() || busy} onClick={async () => {
              const body = note.trim();
              await act({action: 'Note added', summary: body}, 'Note added', 'It is on the timeline.');
              setNote('');
            }}>Save note</button></div></div></div>

        {owner ? <div className="card" style={{borderTop: '2px solid var(--bad)'}}>
          <div className="card-h"><h2>Delete this lead</h2></div><div className="card-b">
          {!confirmDelete
            ? <>
              <p style={{margin: '0 0 10px', fontSize: 13, color: 'var(--ink2)'}}>
                Permanent. The person, the timeline, tasks, reminders, assessments, document
                requests and uploaded files all go with it. Only you can do this.</p>
              <button className="tbtn" onClick={() => setConfirmDelete(true)}>Delete…</button>
            </>
            : <>
              <div className="fld"><label>Why is this being deleted?</label>
                <input value={deleteReason} onChange={e => setDeleteReason(e.target.value)}
                  placeholder="Duplicate · test record · client asked for removal"/></div>
              <p className="note">One line survives: that LEAD-{lead.id} existed and who deleted it.
                Nothing else.</p>
              <div style={{display: 'flex', gap: 8, marginTop: 10}}>
                <button className="tbtn" disabled={busy} onClick={removeLead}
                  style={{borderColor: 'var(--bad)', color: 'var(--bad)'}}>
                  {busy ? 'Deleting…' : 'Delete permanently'}</button>
                <button className="tbtn" onClick={() => { setConfirmDelete(false); setDeleteReason(''); }}>
                  Cancel</button></div>
            </>}
          </div></div> : null}
      </div>
    </div>

    <div className="card" style={{marginTop: 14}}>
      <div className="card-h"><h2>Everything that has happened</h2><span className="spacer"/>
        <span className="n mono">newest first</span></div>
      <div className="scrollx"><table className="tbl"><tbody>
        {(lead.events || []).map((e, i) =>
          <tr key={i}><td className="mono" style={{width: 100, color: 'var(--ink3)'}}>{e[0]}</td>
            <td className="k">{e[1]}</td><td>{e[2]}</td>
            <td style={{textAlign: 'right'}}>
              <span className={'tag ' + (e[3] === 'SYSTEM' ? 't-mute' : 't-acc')}>{e[3]}</span></td></tr>)}
        {!(lead.events || []).length
          ? <tr><td colSpan={4}><div className="empty">Nothing logged yet.</div></td></tr> : null}
      </tbody></table></div></div>
    {toastNode}</div>);
}
