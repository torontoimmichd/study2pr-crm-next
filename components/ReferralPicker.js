'use client';
import {useEffect, useState} from 'react';
import {useStore} from './Store';

/**
 * Some sources are a who, not a what. "Previous customer" and "referred by a
 * client" mean a person already on file; "referred by a partner" means a partner.
 * The search runs on the server so the browser never holds the client list just
 * to offer a dropdown.
 */
export function ReferralPicker({kind, value, onChange, invalid}) {
  const {referralCandidates} = useStore();
  const [q, setQ] = useState('');
  const [rows, setRows] = useState([]);
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState(null);

  useEffect(() => {
    let alive = true;
    const h = setTimeout(async () => {
      try {
        const r = await referralCandidates(kind, q);
        if (alive) { setRows(r); setErr(null); }
      } catch (e) { if (alive) setErr(e.message); }
    }, 220);
    return () => { alive = false; clearTimeout(h); };
  }, [kind, q, referralCandidates]);

  const label = kind === 'partner' ? 'Which partner sent them' : 'Which client or enquiry sent them';

  if (value) {
    return (<div className="fld">
      <label>{label}</label>
      <div style={{display: 'flex', alignItems: 'center', gap: 8, background: 'var(--panel2)',
        border: '1px solid var(--line)', borderRadius: 8, padding: '8px 11px'}}>
        <span style={{fontSize: 13.5}}>{value.name}</span>
        {value.kind ? <span className="tag t-mute">{value.kind}</span> : null}
        <span className="spacer"/>
        <button type="button" className="mini" onClick={() => { onChange(null); setQ(''); setOpen(true); }}>
          Change</button>
      </div>
    </div>);
  }

  return (<div className={'fld' + (invalid ? ' bad' : '')} style={{position: 'relative'}}>
    <label htmlFor="refq">{label}</label>
    <input id="refq" value={q} autoComplete="off"
      placeholder={kind === 'partner' ? 'Type a partner name…' : 'Type a name or phone…'}
      onChange={e => { setQ(e.target.value); setOpen(true); }}
      onFocus={() => setOpen(true)}
      onBlur={() => setTimeout(() => setOpen(false), 160)}/>
    <div className="hint">
      {err ? err
        : kind === 'partner'
          ? 'Partners come from your partner list. Nothing there yet means nobody to pick.'
          : 'Anyone already on file — a past client or an earlier enquiry.'}
    </div>

    {open && rows.length
      ? <div className="picker">
          {rows.map(r => (
            <button type="button" key={r.id} className="picker-row"
              onMouseDown={() => { onChange(r); setOpen(false); }}>
              <span>{r.name}</span>
              {r.kind ? <span className="tag t-mute">{r.kind}</span> : null}
              <span className="spacer"/>
              <span className="mono" style={{fontSize: 11, color: 'var(--ink3)'}}>{r.detail}</span>
            </button>))}
        </div>
      : open && q
      ? <div className="picker"><div className="picker-empty">
          Nobody matches “{q}”.</div></div>
      : null}
  </div>);
}
