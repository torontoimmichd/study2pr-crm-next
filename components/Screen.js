'use client';
import {useEffect, useState, useCallback} from 'react';
import {useStore} from './Store';

/**
 * The shared shape of every read-only screen: load, show an error you can retry,
 * and — when there is nothing — say which table is empty and what fills it,
 * rather than showing an invented row. Nothing in this app renders a number it
 * did not read from the database.
 */
export function useScreen(name) {
  const {read} = useStore();
  const [data, setData] = useState(null);
  const [state, setState] = useState('loading');
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setState('loading');
    try { setData(await read(name)); setState('ready'); }
    catch (e) { setError(e.message); setState('error'); }
  }, [read, name]);

  useEffect(() => { load(); }, [load]);
  return {data, state, error, reload: load};
}

export function Head({title, sub, children}) {
  return (<div className="phead"><div><h1>{title}</h1>
    {sub ? <p className="sub">{sub}</p> : null}</div>
    <span className="spacer"/>{children}</div>);
}

export function Loading() {
  return <div className="card"><div className="card-b"><div className="empty">Loading…</div></div></div>;
}

export function Failed({error, retry}) {
  return (<div className="advice" style={{borderLeftColor: 'var(--bad)'}}>
    <div className="lbl" style={{color: 'var(--bad)'}}>Could not load this screen</div>
    <p>{error}</p>
    <button className="tbtn" onClick={retry} style={{marginTop: 8}}>Try again</button>
  </div>);
}

// Empty is not a failure. It says what is missing and how it gets filled.
export function Waiting({source, what, next}) {
  return (<div className="card"><div className="card-b">
    <div className="empty" style={{padding: 34}}>
      <div style={{fontSize: 15, color: 'var(--ink2)', marginBottom: 6}}>{what}</div>
      <span className="mono" style={{fontSize: 12}}>{source}</span>
      {next ? <div style={{marginTop: 8, fontSize: 13}}>{next}</div> : null}
    </div></div></div>);
}

export function Table({cols, rows, render, empty}) {
  return (<div className="card"><div className="scrollx"><table className="tbl">
    <thead><tr>{cols.map(c => <th key={c}>{c}</th>)}</tr></thead>
    <tbody>
      {rows.map(render)}
      {!rows.length ? <tr><td colSpan={cols.length}>
        <div className="empty">{empty}</div></td></tr> : null}
    </tbody></table></div></div>);
}

export function Stat({label, value, tone}) {
  return (<div className="card"><div className="card-b" style={{padding: '12px 14px'}}>
    <div className="mono" style={{fontSize: 10.5, letterSpacing: '.09em',
      textTransform: 'uppercase', color: 'var(--ink3)'}}>{label}</div>
    <div style={{fontSize: 24, fontWeight: 600, marginTop: 3,
      color: tone === 'bad' ? 'var(--bad)' : tone === 'warn' ? 'var(--warn)' : 'var(--ink)'}}>
      {value}</div>
  </div></div>);
}

// A plain proportional bar. No chart library, no invented scale.
export function Bars({rows, labelKey = 'label', valueKey = 'n'}) {
  const max = rows.reduce((m, r) => Math.max(m, Number(r[valueKey]) || 0), 0) || 1;
  return (<div>{rows.map((r, i) => (
    <div key={i} style={{display: 'flex', gap: 10, alignItems: 'center', padding: '4px 0'}}>
      <span style={{width: 168, fontSize: 12.5, color: 'var(--ink2)', overflow: 'hidden',
        textOverflow: 'ellipsis', whiteSpace: 'nowrap'}}>{r[labelKey]}</span>
      <span style={{flex: 1, height: 8, background: 'var(--panel2)', borderRadius: 5}}>
        <span style={{display: 'block', height: 8, borderRadius: 5,
          width: Math.round((Number(r[valueKey]) || 0) / max * 100) + '%',
          background: 'var(--f1)'}}/></span>
      <span className="mono" style={{width: 34, textAlign: 'right', fontSize: 12}}>{r[valueKey]}</span>
    </div>))}
  </div>);
}
