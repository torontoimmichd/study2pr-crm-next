'use client';
import Link from 'next/link';
import {useState} from 'react';
import {useStore} from '../../components/Store';

// Three bands, worked out in the database from passport country, country of
// residence and the destination — so every module shows the same thing.
export const BAND = {
  onshore: ['ONSHORE', 't-ok', 'Already in the destination country'],
  home: ['HOME', 't-acc', 'Living in their own passport country'],
  third: ['THIRD COUNTRY', 't-warn', 'Living somewhere that is neither'],
  unknown: ['—', 't-mute', 'Passport or residence not recorded'],
};

export default function Leads() {
  const {leads, leadsState, leadsError, reload} = useStore();
  const [q, setQ] = useState('');
  const [band, setBand] = useState('all');

  const list = leads.filter(l => {
    if (band !== 'all' && (l.band || 'unknown') !== band) return false;
    if (q) {
      const hay = [l.name, l.interest, l.owner, l.category, l.subcategory, l.country]
        .filter(Boolean).join(' ').toLowerCase();
      if (hay.indexOf(q.toLowerCase()) < 0) return false;
    }
    return true;
  });

  const count = k => leads.filter(l => (l.band || 'unknown') === k).length;

  return (<div className="page">
    <div className="phead"><div><h1>Leads</h1>
      <p className="sub">Every row is a record in the database, at the stage it is actually in.</p></div>
      <span className="spacer"/>
      <Link href="/leads/new" className="tbtn pri">+ New lead</Link></div>

    {leadsState === 'error'
      ? <div className="advice" style={{borderLeftColor: 'var(--bad)', marginBottom: 12}}>
          <div className="lbl" style={{color: 'var(--bad)'}}>Could not load leads</div>
          <p>{leadsError}</p>
          <button className="tbtn" onClick={reload} style={{marginTop: 8}}>Try again</button>
        </div>
      : null}

    <div style={{display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12, alignItems: 'center'}}>
      <div className="seg">
        <button className={band === 'all' ? 'on' : ''} onClick={() => setBand('all')}>All</button>
        {['onshore', 'home', 'third', 'unknown'].map(k =>
          <button key={k} className={band === k ? 'on' : ''} onClick={() => setBand(k)}
            title={BAND[k][2]}>{BAND[k][0]} {count(k)}</button>)}
      </div>
    </div>

    <div className="card" style={{marginBottom: 12}}><div className="card-b" style={{padding: '10px 14px'}}>
      <input value={q} onChange={e => setQ(e.target.value)}
        placeholder="Filter by name, category, country or owner…"
        style={{width: '100%', background: 'var(--panel2)', border: '1px solid var(--line)', borderRadius: 8,
          padding: '8px 11px', fontSize: 13.5, fontFamily: 'inherit', color: 'var(--ink)'}}/></div></div>

    <div className="card"><div className="scrollx"><table className="tbl">
      <thead><tr>
        <th>Lead</th><th>Where they are</th><th>Service</th><th>Stage</th>
        <th>Next action</th><th>Owner</th></tr></thead>
      <tbody>
        {list.map(l => {
          const [text, tag, why] = BAND[l.band || 'unknown'] || BAND.unknown;
          return (<tr key={l.id}>
            <td className="k"><Link href={'/leads/' + l.id}>{l.name}</Link>
              <div className="mono" style={{fontSize: 11, color: 'var(--ink3)', fontWeight: 400}}>LEAD-{l.id}</div></td>
            <td><span className={'tag ' + tag} title={why}>{text}</span>
              <div style={{fontSize: 11.5, color: 'var(--ink3)', marginTop: 3}}>
                {[l.passport, l.residence].filter(Boolean).join(' → ') || 'not recorded'}</div></td>
            <td>{l.country || '—'}
              <div style={{fontSize: 11.5, color: 'var(--ink2)'}}>
                {[l.category, l.subcategory].filter(Boolean).join(' · ') || '—'}</div></td>
            <td><span className={'tag ' + l.stageTag}>{String(l.stage).toUpperCase()}</span>
              {l.reason && l.reason !== '—'
                ? <div style={{fontSize: 11.5, color: 'var(--ink3)'}}>{l.reason}</div> : null}</td>
            <td>{l.next}</td><td>{l.owner}</td></tr>);
        })}
        {!list.length ? <tr><td colSpan={6}><div className="empty">
          {leadsState === 'loading' ? 'Loading leads…'
            : leadsState === 'error' ? 'Leads could not be loaded.'
            : leads.length ? 'No leads match that filter.'
            : 'No leads yet. The first one you create will be LEAD-000022.'}
        </div></td></tr> : null}
      </tbody>
    </table></div></div>

    <p className="note">
      {leadsState === 'ready'
        ? list.length + ' of ' + leads.length + ' leads. Colour shows where the person is: '
          + 'green already in the destination, blue at home, amber in a third country.'
        : leadsState === 'loading' ? 'Reading from the database…' : 'Not loaded.'}
    </p>
  </div>);
}
