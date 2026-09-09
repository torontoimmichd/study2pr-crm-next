'use client';
import Link from 'next/link';
import {useEffect, useState, useCallback} from 'react';
import {useStore} from '../../components/Store';
import {useToast} from '../../components/ui';
import {DocRequest} from '../../components/DocRequest';

const STATUS = {
  requested: ['REQUESTED', 't-acc'],
  reminder_due: ['CHASING', 't-warn'],
  received: ['RECEIVED', 't-acc'],
  under_review: ['IN REVIEW', 't-acc'],
  accepted: ['ACCEPTED', 't-ok'],
  replace_required: ['REPLACE', 't-bad'],
  expired: ['EXPIRED', 't-bad'],
  waived: ['WAIVED', 't-mute'],
  cancelled: ['CANCELLED', 't-mute'],
  not_applicable: ['N/A', 't-mute'],
  not_yet_needed: ['NOT YET', 't-mute'],
  skipped: ['SKIPPED', 't-mute'],
};

export default function Documents() {
  const {loadDocuments, documentDecision, uploadDocument, documentFiles, documentFileLink} = useStore();
  const [rows, setRows] = useState([]);
  const [state, setState] = useState('loading');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(null);
  const [reason, setReason] = useState({});
  const [files, setFiles] = useState({});
  const [toastNode, toast] = useToast();
  const [asking, setAsking] = useState(false);

  async function showFiles(ref) {
    if (files[ref]) { setFiles(f => Object.assign({}, f, {[ref]: null})); return; }
    try {
      const list = await documentFiles(ref);
      setFiles(f => Object.assign({}, f, {[ref]: list}));
    } catch (e) { toast('Could not list files', e.message); }
  }

  async function upload(ref, file) {
    if (!file) return;
    setBusy(ref);
    try {
      const res = await uploadDocument(ref, file);
      setRows(res.board || []);
      setFiles(f => Object.assign({}, f, {[ref]: null}));
      toast('Received', file.name + ' saved as version ' + res.version + '. The chase reminders stopped.');
    } catch (e) { toast('Upload failed', e.message); }
    finally { setBusy(null); }
  }

  async function open(path) {
    try { window.open(await documentFileLink(path), '_blank', 'noopener'); }
    catch (e) { toast('Could not open the file', e.message); }
  }

  const load = useCallback(async () => {
    setState('loading');
    try { setRows(await loadDocuments()); setState('ready'); }
    catch (e) { setError(e.message); setState('error'); }
  }, [loadDocuments]);

  useEffect(() => { load(); }, [load]);

  async function decide(ref, decision) {
    setBusy(ref);
    try {
      setRows(await documentDecision(ref, decision, reason[ref] || null));
      toast(decision === 'accepted' ? 'Accepted' : decision === 'received' ? 'Marked received' : 'Replacement asked for',
        decision === 'accepted'
          ? 'The request is closed and its chase reminders stopped.'
          : 'The request stays open with a new next action.');
      setReason(r => Object.assign({}, r, {[ref]: ''}));
    } catch (e) { toast('Not saved', e.message); }
    finally { setBusy(null); }
  }

  const waiting = rows.filter(r => ['requested', 'reminder_due'].includes(r.status));
  const toReview = rows.filter(r => ['received', 'under_review', 'replace_required'].includes(r.status));
  const late = rows.filter(r => r.overdue);

  return (<div className="page">
    <div className="phead"><div><h1>Documents</h1>
      <p className="sub">Every request came from a requirement on an eligible route, with the reason it is needed attached.</p></div>
      <span className="spacer"/>
      <button className="tbtn" onClick={load}>Refresh</button>
      <button className="tbtn pri" onClick={() => setAsking(true)}>Request documents</button></div>

    {error ? <div className="advice" style={{borderLeftColor: 'var(--bad)', marginBottom: 12}}>
      <div className="lbl" style={{color: 'var(--bad)'}}>Could not load documents</div><p>{error}</p></div> : null}

    <div style={{display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14}}>
      <span className="tag t-acc">{waiting.length} AWAITING</span>
      <span className="tag t-ok">{toReview.length} TO REVIEW</span>
      <span className={'tag ' + (late.length ? 't-warn' : 't-mute')}>{late.length} OVERDUE</span>
    </div>

    <div className="card"><div className="scrollx"><table className="tbl">
      <thead><tr><th>Document</th><th>Person</th><th>Status</th><th>Due</th><th>Chases</th><th>Decision</th></tr></thead>
      <tbody>
        {rows.map(r => {
          const [text, tag] = STATUS[r.status] || [String(r.status).toUpperCase(), 't-mute'];
          return (<tr key={r.ref}>
            <td className="k">{r.name}
              <div className="mono" style={{fontSize: 11, color: 'var(--ink3)', fontWeight: 400}}>
                {r.ref}{r.blocking ? ' · blocks submission' : ''}</div>
              <div style={{fontSize: 12, color: 'var(--ink2)', fontWeight: 400}}>{r.why}</div></td>
            <td>{r.lead ? <Link href={'/leads/' + r.lead}>{r.person}</Link> : r.person}
              <div className="mono" style={{fontSize: 11, color: 'var(--ink3)'}}>{r.assessment}</div></td>
            <td><span className={'tag ' + tag}>{text}</span></td>
            <td className="mono">{r.due}
              <div style={{fontSize: 11, color: r.overdue ? 'var(--bad)' : 'var(--ink3)'}}>
                {r.overdue ? Math.abs(r.days_left) + ' days late' : r.days_left + ' days left'}</div></td>
            <td className="mono">{r.chases}{r.next_chase ? <div style={{fontSize: 11, color: 'var(--ink3)'}}>next {r.next_chase}</div> : null}</td>
            <td>
              {['accepted', 'waived', 'cancelled'].includes(r.status) ? <span className="n">—</span> : <>
                <div style={{display: 'flex', gap: 6, flexWrap: 'wrap'}}>
                  <label className="tbtn" style={{cursor: busy === r.ref ? 'default' : 'pointer'}}>
                    {busy === r.ref ? 'Uploading…' : 'Upload'}
                    <input type="file" hidden disabled={busy === r.ref}
                      onChange={e => { upload(r.ref, e.target.files[0]); e.target.value = ''; }}/>
                  </label>
                  <button className="tbtn" onClick={() => showFiles(r.ref)}>Files</button>
                  <button className="tbtn pri" disabled={busy === r.ref} onClick={() => decide(r.ref, 'accepted')}>Accept</button>
                  <button className="tbtn" disabled={busy === r.ref} onClick={() => decide(r.ref, 'replace_required')}>Replace</button>
                </div>
                <input value={reason[r.ref] || ''} placeholder="Reason (kept on the file)"
                  onChange={e => setReason(x => Object.assign({}, x, {[r.ref]: e.target.value}))}
                  style={{marginTop: 6, width: '100%', background: 'var(--panel2)', border: '1px solid var(--line)',
                    borderRadius: 7, padding: '5px 8px', fontSize: 12, fontFamily: 'inherit', color: 'var(--ink)'}}/>
              </>}
            </td></tr>);
        })}
        {rows.filter(r => files[r.ref]).map(r => (
          <tr key={r.ref + '-files'}><td colSpan={6} style={{background: 'var(--panel2)'}}>
            {!files[r.ref].length
              ? <div className="empty">Nothing uploaded against {r.ref} yet.</div>
              : files[r.ref].map(f => <div key={f.version}
                  style={{display: 'flex', gap: 10, alignItems: 'baseline', padding: '4px 0'}}>
                  <span className="tag t-mute mono">v{f.version}</span>
                  <button className="mini" onClick={() => open(f.path)}
                    style={{background: 'none', border: 0, padding: 0, cursor: 'pointer',
                      color: 'var(--accent)', font: 'inherit'}}>{f.name}</button>
                  <span className="n mono">{f.size ? Math.round(f.size / 1024) + ' KB' : ''}</span>
                  <span className="spacer"/>
                  <span className="n mono">{f.at} · {f.by}</span>
                  {f.current ? <span className="tag t-ok">CURRENT</span>
                             : <span className="tag t-mute">SUPERSEDED</span>}
                </div>)}
          </td></tr>))}
        {!rows.length ? <tr><td colSpan={6}><div className="empty">
          {state === 'loading' ? 'Loading…' : state === 'error' ? 'Not loaded.'
            : 'No document requests yet. Run an assessment and request from its plan.'}
        </div></td></tr> : null}
      </tbody>
    </table></div></div>

    <p className="note">Uploading a file marks the request received and stops its chase reminders.
      A replacement is stored as a new version — nothing overwrites or deletes what came before,
      and every link is signed and expires in two minutes.</p>
    <p className="note">Chase dates advance on their own every hour. Nothing is sent to the client yet —
      there is no messaging channel wired, so the state moves and the reminder is recorded, but no message goes out.</p>
    {asking ? <DocRequest onClose={() => setAsking(false)}
      onSent={n => { setAsking(false); load();
        toast('Requested', n + ' document request(s) raised, each with its due date and chase schedule.'); }}/> : null}

    {toastNode}</div>);
}
