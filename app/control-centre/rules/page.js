'use client';
import Link from 'next/link';
import {useEffect, useState, useCallback} from 'react';
import {useStore} from '../../../components/Store';
import {useToast} from '../../../components/ui';

// The value is jsonb and its shape follows the operator, so the form converts
// what was typed rather than making the user write JSON.
function toValue(operator, text) {
  const t = String(text ?? '').trim();
  if (!t) return null;
  if (operator === 'in') return t.split(',').map(s => s.trim()).filter(Boolean);
  if (operator === '>=' || operator === '<=') {
    const n = Number(t);
    if (Number.isNaN(n)) throw new Error('That operator needs a number.');
    return n;
  }
  return t;
}

function showValue(v) {
  if (v === null || v === undefined) return '';
  if (Array.isArray(v)) return v.join(', ');
  return String(v);
}

const OP = {is: 'must be', in: 'must be one of', '>=': 'at least', '<=': 'at most'};

export default function Rules() {
  const {loadRules, verifyRule, deactivateRule, loadPolicySources} = useStore();
  const [rows, setRows] = useState([]);
  const [sources, setSources] = useState([]);
  const [state, setState] = useState('loading');
  const [error, setError] = useState(null);
  const [openCode, setOpenCode] = useState(null);
  const [form, setForm] = useState({});
  const [busy, setBusy] = useState(false);
  const [toastNode, toast] = useToast();

  const load = useCallback(async () => {
    setState('loading');
    try {
      const [r, s] = await Promise.all([loadRules(), loadPolicySources()]);
      setRows(r); setSources(s); setState('ready');
    } catch (e) { setError(e.message); setState('error'); }
  }, [loadRules, loadPolicySources]);

  useEffect(() => { load(); }, [load]);

  function openRule(r) {
    if (openCode === r.code) { setOpenCode(null); return; }
    setOpenCode(r.code);
    setForm({
      value: showValue(r.value),
      url: r.source_url || '',
      title: r.source_title || '',
      publisher: 'IRCC',
      quote: r.quote || '',
      next: r.source_next_check || '',
      reason: '',
    });
  }

  async function save(code, operator, activate) {
    setBusy(true);
    try {
      const next = await verifyRule({
        code,
        value: toValue(operator, form.value),
        url: form.url, title: form.title, publisher: form.publisher,
        quote: form.quote, nextCheck: form.next || null,
        activate,
      });
      setRows(next);
      setSources(await loadPolicySources());
      toast(activate ? 'Rule is live' : 'Check recorded',
        activate
          ? 'Assessments will now use this threshold, and say so.'
          : 'The value and source are saved. The rule stays off until you activate it.');
      if (activate) setOpenCode(null);
    } catch (e) { toast('Not saved', e.message); }
    finally { setBusy(false); }
  }

  async function switchOff(code) {
    if (!form.reason.trim()) { toast('Reason needed', 'Say why the rule is being switched off.'); return; }
    setBusy(true);
    try {
      setRows(await deactivateRule(code, form.reason.trim()));
      toast('Switched off', 'It will not affect a verdict until it is verified again.');
      setOpenCode(null);
    } catch (e) { toast('Not saved', e.message); }
    finally { setBusy(false); }
  }

  const live = rows.filter(r => r.active).length;
  const groups = [];
  rows.forEach(r => {
    const last = groups[groups.length - 1];
    if (last && last.name === r.programme) last.items.push(r);
    else groups.push({name: r.programme, version: r.version, family: r.family, items: [r]});
  });

  return (<div className="page">
    <div className="phead"><div>
      <Link href="/control-centre" className="mini" style={{display: 'inline-block', marginBottom: 9}}>&larr; Control Centre</Link>
      <h1>Eligibility rules</h1>
      <p className="sub">A rule decides what the system tells a client. It stays off until somebody
        confirms its value against the authority and signs for it.</p></div>
      <span className="spacer"/>
      <span className={'tag ' + (live === rows.length ? 't-ok' : live ? 't-warn' : 't-mute')}>
        {live} OF {rows.length} LIVE</span>
    </div>

    {error ? <div className="advice" style={{borderLeftColor: 'var(--bad)', marginBottom: 12}}>
      <div className="lbl" style={{color: 'var(--bad)'}}>Could not load the rules</div><p>{error}</p></div> : null}

    {state === 'ready' && live < rows.length ? <div className="advice" style={{marginBottom: 14}}>
      <div className="lbl">Why this matters</div>
      <p>While a route has any unconfirmed rule, an assessment on it can only come back
        <b> needs review</b> — never <b>suitable</b>. Confirm every rule on a route and that
        route starts producing a clean answer.</p>
    </div> : null}

    <div className="grid g2" style={{alignItems: 'start'}}>
      <div>
        {state === 'loading' ? <div className="card"><div className="card-b"><div className="empty">Loading…</div></div></div> : null}

        {groups.map(g => <div className="card" key={g.name} style={{marginBottom: 14}}>
          <div className="card-h"><h2>{g.name}</h2>
            <span className="tag t-mute">{g.version}</span><span className="spacer"/>
            <span className="n mono">{g.items.filter(i => i.active).length}/{g.items.length} live</span></div>
          <div className="card-b" style={{paddingTop: 4}}>
            {g.items.map(r => <div key={r.code} style={{borderTop: '1px solid var(--line)', padding: '9px 0'}}>
              <div style={{display: 'flex', gap: 9, alignItems: 'baseline', cursor: 'pointer'}}
                   onClick={() => openRule(r)}>
                <span className="mono" style={{fontSize: 12.5, minWidth: 168}}>{r.fact}</span>
                <span style={{fontSize: 12.5, color: 'var(--ink2)'}}>
                  {OP[r.operator] || r.operator} <b>{showValue(r.value)}</b></span>
                <span className="spacer"/>
                {r.active
                  ? <span className="tag t-ok">LIVE</span>
                  : <span className="tag t-warn">UNCONFIRMED</span>}
              </div>

              {openCode === r.code ? <div style={{padding: '10px 0 4px'}}>
                <p style={{margin: '0 0 10px', fontSize: 12.5, color: 'var(--ink2)'}}>
                  Client is told: <i>{r.needs}</i></p>
                <div className="form">
                  <div className="fld"><label>Confirmed value{r.operator === 'in' ? ' (comma separated)' : ''}</label>
                    <input value={form.value} onChange={e => setForm(f => ({...f, value: e.target.value}))}/>
                    <div className="hint">Placeholder from the workbook was <b>{showValue(r.value)}</b>.</div></div>
                  <div className="fld"><label>Authority page (URL)</label>
                    <input value={form.url} placeholder="https://www.canada.ca/…"
                      onChange={e => setForm(f => ({...f, url: e.target.value}))}/></div>
                  <div className="fld"><label>Page title</label>
                    <input value={form.title} onChange={e => setForm(f => ({...f, title: e.target.value}))}/></div>
                  <div className="fld"><label>Re-check on</label>
                    <input type="date" value={form.next || ''}
                      onChange={e => setForm(f => ({...f, next: e.target.value}))}/></div>
                </div>
                <div className="fld" style={{marginTop: 10}}><label>The sentence it rests on</label>
                  <textarea rows={2} value={form.quote}
                    onChange={e => setForm(f => ({...f, quote: e.target.value}))}
                    placeholder="Paste the line from the authority page that this threshold comes from."/></div>

                <div style={{display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap'}}>
                  <button className="tbtn pri" disabled={busy} onClick={() => save(r.code, r.operator, true)}>
                    {busy ? 'Saving…' : 'Confirm and switch on'}</button>
                  <button className="tbtn" disabled={busy} onClick={() => save(r.code, r.operator, false)}>
                    Save the check only</button>
                  {r.active ? <>
                    <span className="spacer"/>
                    <input value={form.reason} placeholder="Reason to switch off"
                      onChange={e => setForm(f => ({...f, reason: e.target.value}))}
                      style={{background: 'var(--panel2)', border: '1px solid var(--line)', borderRadius: 7,
                        padding: '5px 8px', fontSize: 12, fontFamily: 'inherit', color: 'var(--ink)'}}/>
                    <button className="tbtn" disabled={busy} onClick={() => switchOff(r.code)}>Switch off</button>
                  </> : null}
                </div>

                {r.verified_on ? <p className="note">
                  Last checked {r.verified_on} by {r.verified_by}
                  {r.source_title ? <> · <b>{r.source_title}</b></> : null}</p> : null}
              </div> : null}
            </div>)}
          </div></div>)}
      </div>

      <div className="card"><div className="card-h"><h2>Authority sources</h2><span className="spacer"/>
        <span className="n mono">{sources.length}</span></div>
        <div className="card-b">
          {!sources.length ? <div className="empty">No sources recorded yet. The first one you
            paste against a rule appears here.</div>
            : sources.map(s => <div key={s.url} style={{borderTop: '1px solid var(--line)', padding: '9px 0'}}>
              <a href={s.url} target="_blank" rel="noopener noreferrer"
                 style={{fontSize: 13, fontWeight: 600}}>{s.title}</a>
              <div className="mono" style={{fontSize: 11, color: 'var(--ink3)', wordBreak: 'break-all'}}>{s.url}</div>
              <div style={{display: 'flex', gap: 8, marginTop: 5, flexWrap: 'wrap', alignItems: 'baseline'}}>
                <span className="tag t-mute">{s.cites} rule{s.cites === 1 ? '' : 's'}</span>
                <span className="n mono">checked {s.checked_on}</span>
                {s.next_check_on
                  ? <span className={'tag ' + (s.due_recheck ? 't-warn' : 't-mute')}>
                      {s.due_recheck ? 'RE-CHECK DUE' : 're-check ' + s.next_check_on}</span>
                  : null}
              </div>
            </div>)}
          <p className="note">Policy moves. A source with a re-check date will tell you when it is
            time to look again, rather than quietly ageing.</p>
        </div></div>
    </div>
    {toastNode}</div>);
}
