'use client';
import Link from 'next/link';
import {useEffect, useState, useCallback} from 'react';
import {useStore} from '../../components/Store';

const LABEL = {
  suitable: ['SUITABLE', 't-ok'],
  possible_needs_review: ['NEEDS REVIEW', 't-warn'],
  more_information_required: ['MORE INFORMATION', 't-acc'],
  not_suitable: ['NOT SUITABLE', 't-mute'],
};

export default function Assessments() {
  const {loadAssessments} = useStore();
  const [rows, setRows] = useState([]);
  const [state, setState] = useState('loading');
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setState('loading');
    try { setRows(await loadAssessments()); setState('ready'); }
    catch (e) { setError(e.message); setState('error'); }
  }, [loadAssessments]);

  useEffect(() => { load(); }, [load]);

  return (<div className="page">
    <div className="phead"><div><h1>Assessments</h1>
      <p className="sub">Every assessment is the answers, the rules that ran against them, and the verdict those rules produced — kept together.</p></div>
      <span className="spacer"/>
      <Link href="/assessments/new" className="tbtn pri">+ New assessment</Link></div>

    {state === 'error' ? <div className="advice" style={{borderLeftColor: 'var(--bad)', marginBottom: 12}}>
      <div className="lbl" style={{color: 'var(--bad)'}}>Could not load assessments</div>
      <p>{error}</p><button className="tbtn" onClick={load} style={{marginTop: 8}}>Try again</button>
    </div> : null}

    <div className="card"><div className="scrollx"><table className="tbl">
      <thead><tr><th>Reference</th><th>Person</th><th>Result</th><th>Summary</th><th>Conducted by</th><th>When</th></tr></thead>
      <tbody>
        {rows.map(r => {
          const [text, tag] = LABEL[r.result] || [String(r.result || '').toUpperCase(), 't-mute'];
          return (<tr key={r.ref}>
            <td className="k">{r.lead ? <Link href={'/leads/' + r.lead}>{r.ref}</Link> : r.ref}</td>
            <td>{r.name}</td>
            <td><span className={'tag ' + tag}>{text}</span></td>
            <td>{r.summary}{r.missing ? <div className="mono" style={{fontSize: 11, color: 'var(--ink3)'}}>{r.missing}</div> : null}</td>
            <td>{r.by}</td><td className="mono">{r.at}</td></tr>);
        })}
        {!rows.length ? <tr><td colSpan={6}><div className="empty">
          {state === 'loading' ? 'Loading…' : state === 'error' ? 'Not loaded.'
            : 'No assessments yet. Open a lead and run one.'}</div></td></tr> : null}
      </tbody>
    </table></div></div>

    <p className="note">A result of “needs review” means the routes came out eligible, but on thresholds
      that have not yet been confirmed against the authority.</p>
  </div>);
}
