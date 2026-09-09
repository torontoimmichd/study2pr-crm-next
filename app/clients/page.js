'use client';
import Link from 'next/link';
import {useState} from 'react';
import {useScreen, Head, Loading, Failed, Waiting, Table} from '../../components/Screen';
import {BAND} from '../leads/page';

export default function Clients() {
  const {data, state, error, reload} = useScreen('clients');
  const [q, setQ] = useState('');
  if (state === 'loading') return <div className="page"><Loading/></div>;
  if (state === 'error') return <div className="page"><Failed error={error} retry={reload}/></div>;

  const all = data.rows || [];
  const rows = q ? all.filter(r => (r.name + ' ' + (r.phone || '') + ' ' + (r.email || ''))
    .toLowerCase().includes(q.toLowerCase())) : all;

  return (<div className="page">
    <Head title="Clients" sub="Every person on file, however they arrived.">
      <button className="tbtn" onClick={reload}>Refresh</button>
    </Head>

    {!all.length
      ? <Waiting source="people" what="Nobody on file yet."
          next={<>A person is created the moment you add a lead. <Link href="/leads/new">Add one</Link>.</>}/>
      : <>
        <div className="card" style={{marginBottom: 12}}><div className="card-b" style={{padding: '10px 14px'}}>
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Filter by name, phone or email…"
            style={{width: '100%', background: 'var(--panel2)', border: '1px solid var(--line)',
              borderRadius: 8, padding: '8px 11px', fontSize: 13.5, fontFamily: 'inherit',
              color: 'var(--ink)'}}/></div></div>
        <Table cols={['Name', 'Contact', 'Where they are', 'Open leads', 'Files', 'On file since']}
          rows={rows} empty="Nobody matches that."
          render={r => {
            const [text, tag, why] = BAND[r.band || 'unknown'] || BAND.unknown;
            return (<tr key={r.id}>
              <td className="k">{r.name}</td>
              <td>{r.phone || '—'}<div style={{fontSize: 11.5, color: 'var(--ink3)'}}>{r.email || ''}</div></td>
              <td><span className={'tag ' + tag} title={why}>{text}</span>
                <div style={{fontSize: 11.5, color: 'var(--ink3)', marginTop: 3}}>
                  {[r.passport, r.residence].filter(Boolean).join(' → ') || 'not recorded'}</div></td>
              <td className="mono">{r.leads}</td><td className="mono">{r.matters}</td>
              <td className="mono">{r.since}</td></tr>);
          }}/>
        <p className="note">{rows.length} of {all.length} people.</p>
      </>}
  </div>);
}
