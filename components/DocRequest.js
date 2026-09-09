'use client';
import {useEffect, useState} from 'react';
import {useStore} from './Store';
import {Drawer} from './CC';

/**
 * Requesting a document list, from anywhere — not only in the moment just after
 * an assessment is saved. That was the whole gap: the plan existed, the function
 * existed, and the only screen that could reach them was one you could never get
 * back to.
 *
 * A request hangs off an assessment because the schema refuses one without it,
 * so the first step is choosing which assessment this list belongs to.
 */
export function DocRequest({onClose, onSent}) {
  const {loadAssessments, loadDocumentPlan, requestDocuments} = useStore();
  const [list, setList] = useState(null);
  const [ref, setRef] = useState('');
  const [plan, setPlan] = useState(null);
  const [picked, setPicked] = useState({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  useEffect(() => {
    (async () => {
      try { setList(await loadAssessments()); }
      catch (e) { setErr(e.message); setList([]); }
    })();
  }, [loadAssessments]);

  useEffect(() => {
    if (!ref) { setPlan(null); return; }
    let alive = true;
    (async () => {
      setErr(null); setPlan(null);
      try {
        const p = await loadDocumentPlan(ref);
        if (!alive) return;
        setPlan(p);
        const pre = {};
        (p.items || []).forEach(i => { if (i.mandatory && !i.requested) pre[i.requirement_id] = true; });
        setPicked(pre);
      } catch (e) { if (alive) setErr(e.message); }
    })();
    return () => { alive = false; };
  }, [ref, loadDocumentPlan]);

  const items = plan?.items ?? [];
  const outstanding = items.filter(i => !i.requested);
  const ids = Object.keys(picked).filter(k => picked[k]);

  async function send() {
    setBusy(true); setErr(null);
    try {
      const res = await requestDocuments(ref, ids);
      onSent(res.created ?? ids.length);
    } catch (e) { setErr(e.message); setBusy(false); }
  }

  return (<Drawer
    title="Request documents"
    sub="Pick the assessment this list belongs to, then choose what to ask for."
    onClose={onClose}
    footer={<>
      {err ? <p className="drawer-err">{err}</p>
           : <span className="spacer"/>}
      <button className="tbtn" onClick={onClose} disabled={busy}>Cancel</button>
      <button className="tbtn pri" onClick={send} disabled={busy || !ref || !ids.length}>
        {busy ? 'Requesting…' : ids.length ? 'Request ' + ids.length + ' document' + (ids.length === 1 ? '' : 's') : 'Nothing selected'}
      </button>
    </>}>

    <div className="fld" style={{marginBottom: 16}}>
      <label htmlFor="dr_a">Assessment</label>
      <select id="dr_a" value={ref} onChange={e => setRef(e.target.value)}>
        <option value="">Choose…</option>
        {(list ?? []).map(a => <option key={a.ref} value={a.ref}>
          {a.ref} — {a.name}{a.result ? ' (' + String(a.result).replace(/_/g, ' ') + ')' : ''}
        </option>)}
      </select>
      <div className="hint">
        {list === null ? 'Loading assessments…'
          : list.length ? 'The plan below comes from the routes this assessment matched.'
          : 'There are no assessments yet. Open a lead and run one first — a document request has to hang off an assessment.'}
      </div>
    </div>

    {!ref ? null
      : !plan ? <div className="empty">Loading the plan…</div>
      : !items.length
      ? <div className="empty">This assessment matched no route with document requirements behind it.</div>
      : <>
        <div style={{display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap'}}>
          <button className="mini" onClick={() => {
            const all = {}; outstanding.forEach(i => { all[i.requirement_id] = true; }); setPicked(all);
          }}>Select all outstanding</button>
          <button className="mini" onClick={() => setPicked({})}>Clear</button>
          <span className="spacer"/>
          <span className="n mono">{ids.length} of {outstanding.length} outstanding</span>
        </div>

        <div className="card"><div className="scrollx"><table className="tbl">
          <thead><tr><th/><th>Document</th><th>Why it is needed</th><th>Status</th></tr></thead>
          <tbody>{items.map(i => (
            <tr key={i.requirement_id}>
              <td style={{width: 34}}>
                <input type="checkbox" style={{width: 15, height: 15}}
                  disabled={!!i.requested}
                  checked={!!picked[i.requirement_id]}
                  onChange={e => setPicked(p => ({...p, [i.requirement_id]: e.target.checked}))}/>
              </td>
              <td className="k">{i.name}
                {i.mandatory ? <span className="tag t-bad" style={{marginLeft: 6}}>BLOCKING</span> : null}</td>
              <td style={{fontSize: 12.5, color: 'var(--ink2)'}}>{i.why}</td>
              <td>{i.requested
                ? <span className="tag t-mute">ALREADY ASKED</span>
                : <span className="tag t-acc">NOT ASKED</span>}</td>
            </tr>))}
          </tbody></table></div></div>
      </>}

    <p className="note">Each request gets its own due date and chase schedule. Nothing is sent to the
      client yet — no channel is connected — so the request is raised and the chase clock starts,
      but no message leaves the building.</p>
  </Drawer>);
}
