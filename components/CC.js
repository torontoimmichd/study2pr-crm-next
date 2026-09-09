'use client';
import {useEffect, useState} from 'react';

/**
 * The editing half of the Control Centre.
 *
 * Every list in here is described once — its fields, and the save function
 * behind it — and this file turns that description into a form. The forms do no
 * validation of their own beyond "required": the database already refuses a
 * country with no name, a role with no permission, a stage that still has leads
 * in it, and it refuses them with a sentence. Duplicating those rules here would
 * only let the two drift apart, so the drawer shows whatever the database said.
 */

export function Drawer({title, sub, onClose, children, footer}) {
  useEffect(() => {
    const h = e => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', h); document.body.style.overflow = ''; };
  }, [onClose]);

  return (<div className="drawer-wrap" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
    <aside className="drawer" role="dialog" aria-modal="true" aria-label={title}>
      <div className="drawer-h">
        <div><h2>{title}</h2>{sub ? <p className="sub">{sub}</p> : null}</div>
        <span className="spacer"/>
        <button className="mini" onClick={onClose} aria-label="Close">Close</button>
      </div>
      <div className="drawer-b">{children}</div>
      {footer ? <div className="drawer-f">{footer}</div> : null}
    </aside>
  </div>);
}

function optionsFor(f, config) {
  if (!f.opts) return null;
  if (Array.isArray(f.opts)) return f.opts.map(o =>
    typeof o === 'string' ? {v: o, l: o.replace(/_/g, ' ')} : o);
  const rows = config?.[f.opts.from] ?? [];
  return rows
    .filter(r => (f.opts.where ? f.opts.where(r) : true))
    .map(r => ({v: r[f.opts.value ?? 'id'], l: f.opts.label ? f.opts.label(r) : r.name}));
}

function Field({f, value, set, config}) {
  const id = 'f_' + f.k;
  const opts = optionsFor(f, config);

  if (f.type === 'bool') {
    return (<div className="fld" style={{display: 'flex', alignItems: 'center', gap: 9}}>
      <input id={id} type="checkbox" style={{width: 16, height: 16}}
        checked={!!value} onChange={e => set(e.target.checked)}/>
      <label htmlFor={id} style={{margin: 0, textTransform: 'none', letterSpacing: 0,
        fontFamily: 'inherit', fontSize: 13.5, color: 'var(--ink2)'}}>{f.label}</label>
    </div>);
  }

  return (<div className="fld" style={f.wide ? {gridColumn: '1 / -1'} : undefined}>
    <label htmlFor={id}>{f.label}{f.required ? ' *' : ''}</label>
    {f.type === 'area'
      ? <textarea id={id} rows={f.rows ?? 3} value={value ?? ''} onChange={e => set(e.target.value)}/>
      : opts
      ? <select id={id} value={value ?? ''} onChange={e => set(e.target.value || null)}>
          <option value="">{f.required ? 'Choose…' : '— none —'}</option>
          {opts.map(o => <option key={String(o.v)} value={o.v}>{o.l}</option>)}
        </select>
      : <input id={id} type={f.type === 'num' ? 'number' : f.type === 'email' ? 'email' : 'text'}
          value={value ?? ''} onChange={e => set(f.type === 'num'
            ? (e.target.value === '' ? null : Number(e.target.value))
            : e.target.value)}/>}
    {f.hint ? <div className="hint">{f.hint}</div> : null}
  </div>);
}

/** Builds the form for one record and hands the finished parameters back. */
export function RecordForm({spec, row, config, onSaved, onClose, save}) {
  const [v, setV] = useState(() => {
    const init = {};
    for (const f of spec.fields) {
      const raw = row ? row[f.from ?? f.k] : undefined;
      init[f.k] = raw === undefined || raw === null
        ? (f.default !== undefined ? f.default : (f.type === 'bool' ? true : null))
        : raw;
    }
    return init;
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  const missing = spec.fields.filter(f => f.required &&
    (v[f.k] === null || v[f.k] === undefined || String(v[f.k]).trim() === ''));

  async function submit() {
    setErr(null);
    if (missing.length) { setErr('Fill in ' + missing.map(f => f.label.toLowerCase()).join(', ') + '.'); return; }
    setBusy(true);
    try {
      const params = {};
      if (spec.hasId !== false) params.p_id = row?.id ?? null;
      for (const f of spec.fields) params[f.p ?? ('p_' + f.k)] = v[f.k] ?? null;
      Object.assign(params, spec.extra ? spec.extra(v, row, config) : {});
      await save(spec.fn, params);
      onSaved();
    } catch (e) {
      // The database's own sentence. It is written for the person reading it.
      setErr(e.message ?? 'Could not save.');
      setBusy(false);
    }
  }

  return (<Drawer
    title={(row ? 'Edit ' : 'Add ') + spec.singular}
    sub={row ? (row.name ?? row.code ?? '') : spec.addHint}
    onClose={onClose}
    footer={<>
      {err ? <p className="drawer-err">{err}</p> : <span className="spacer"/>}
      <button className="tbtn" onClick={onClose} disabled={busy}>Cancel</button>
      <button className="tbtn pri" onClick={submit} disabled={busy}>
        {busy ? 'Saving…' : row ? 'Save changes' : 'Add ' + spec.singular}</button>
    </>}>
    <div className="form">
      {spec.fields.map(f => <Field key={f.k} f={f} config={config}
        value={v[f.k]} set={x => setV(s => ({...s, [f.k]: x}))}/>)}
    </div>
    {spec.note ? <p className="note">{spec.note}</p> : null}
  </Drawer>);
}

export function Cell({v}) {
  if (v === null || v === undefined || v === '') return <span style={{color: 'var(--ink3)'}}>—</span>;
  if (typeof v === 'boolean') return <span className={'tag ' + (v ? 't-ok' : 't-mute')}>{v ? 'YES' : 'NO'}</span>;
  if (Array.isArray(v)) return v.length ? String(v.join(', ')) : <span style={{color: 'var(--ink3)'}}>—</span>;
  if (typeof v === 'object') return <span className="mono" style={{fontSize: 11}}>{JSON.stringify(v).slice(0, 40)}</span>;
  return String(v);
}
