'use client';
import {useScreen, Head, Loading, Failed, Table} from '../../components/Screen';

export default function HR() {
  const {data, state, error, reload} = useScreen('hr');
  if (state === 'loading') return <div className="page"><Loading/></div>;
  if (state === 'error') return <div className="page"><Failed error={error} retry={reload}/></div>;

  const members = data.members || [];
  const leave = data.leave || [];

  return (<div className="page">
    <Head title="HR" sub="Who works here, what they are responsible for, and how much they are carrying.">
      <button className="tbtn" onClick={reload}>Refresh</button>
    </Head>

    <Table cols={['Member', 'Roles', 'Branch', 'Responsibilities', 'Open leads', 'Capacity']}
      rows={members} empty="No members." render={m => (<tr key={m.id}>
        <td className="k">{m.name}<div style={{fontSize: 11.5, color: 'var(--ink3)'}}>{m.job_title}</div></td>
        <td>{m.roles}</td><td>{m.branch}</td>
        <td>{(m.responsibilities || []).length
          ? (m.responsibilities || []).map((r, i) => <div key={i} style={{fontSize: 12}}>
              {r.country} · {r.responsibility}{r.category ? ' · ' + r.category : ''}</div>)
          : <span className="n">Not set</span>}</td>
        <td className="mono">{m.open_leads}</td>
        <td className="mono">{m.max_leads} leads · {m.max_applications} files</td></tr>)}/>

    <p className="note">Responsibilities decide whose work a lead is. They are set per person,
      per country, and can be narrowed to a single service.</p>

    {leave.length ? <div style={{marginTop: 14}}>
      <h3 className="sec">Leave and cover</h3>
      <Table cols={['Member', 'Kind', 'From', 'To']} rows={leave} empty="None recorded."
        render={(l, i) => (<tr key={i}><td className="k">{l.member}</td><td>{l.kind}</td>
          <td className="mono">{l.from}</td><td className="mono">{l.to}</td></tr>)}/>
    </div> : null}
  </div>);
}
