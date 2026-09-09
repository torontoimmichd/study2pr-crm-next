'use client';
import Link from 'next/link';
import {useScreen, Head, Loading, Failed, Stat, Bars, Table} from '../components/Screen';

export default function Dashboard() {
  const {data, state, error, reload} = useScreen('dashboard');
  if (state === 'loading') return <div className="page"><Loading/></div>;
  if (state === 'error') return <div className="page"><Failed error={error} retry={reload}/></div>;

  const c = data.counts || {};
  const due = data.due_today || [];
  const late = data.documents_late || [];
  const appts = data.appointments_today || [];
  const byStage = data.by_stage || [];
  const quiet = !due.length && !late.length && !appts.length && !byStage.length;

  return (<div className="page">
    <Head title="Today" sub="What is due, what is late, and who is coming in.">
      <button className="tbtn" onClick={reload}>Refresh</button>
    </Head>

    <div className="grid g4" style={{marginBottom: 14}}>
      <Stat label="Open leads" value={c.leads ?? 0}/>
      <Stat label="Documents out" value={c.documents ?? 0}
        tone={c.documents_overdue ? 'warn' : undefined}/>
      <Stat label="Appointments this week" value={c.appointments ?? 0}/>
      <Stat label="Rules unverified" value={c.rules_unverified ?? 0}
        tone={c.rules_unverified ? 'warn' : undefined}/>
    </div>

    {quiet ? <div className="card"><div className="card-b">
      <div className="empty" style={{padding: 34}}>
        <div style={{fontSize: 15, color: 'var(--ink2)', marginBottom: 6}}>Nothing is due and nothing is late.</div>
        <span className="mono" style={{fontSize: 12}}>leads · appointments · document_requests</span>
        <div style={{marginTop: 10}}>
          <Link className="tbtn pri" href="/leads/new">Add the first lead</Link></div>
      </div></div></div> : null}

    <div className="grid g2" style={{alignItems: 'start'}}>
      {due.length ? <div className="card"><div className="card-h"><h2>Due now</h2><span className="spacer"/>
        <span className="n mono">{due.length}</span></div>
        <div className="scrollx"><table className="tbl"><tbody>
          {due.map(d => <tr key={d.ref}>
            <td className="k"><Link href={'/leads/' + d.ref}>{d.name}</Link>
              <div className="mono" style={{fontSize: 11, color: 'var(--ink3)'}}>LEAD-{d.ref}</div></td>
            <td>{d.action}</td>
            <td className="mono" style={{color: d.late ? 'var(--bad)' : 'var(--ink3)'}}>{d.due}</td></tr>)}
        </tbody></table></div></div> : null}

      {appts.length ? <div className="card"><div className="card-h"><h2>Today&rsquo;s appointments</h2></div>
        <div className="scrollx"><table className="tbl"><tbody>
          {appts.map((a, i) => <tr key={i}>
            <td className="mono" style={{width: 60}}>{a.time}</td>
            <td className="k">{a.person}</td><td>{a.kind}</td>
            <td>{a.lead ? <Link href={'/leads/' + a.lead}>LEAD-{a.lead}</Link> : null}</td></tr>)}
        </tbody></table></div></div> : null}

      {late.length ? <div className="card"><div className="card-h"><h2>Documents overdue</h2></div>
        <div className="scrollx"><table className="tbl"><tbody>
          {late.map(d => <tr key={d.ref}>
            <td className="k">{d.name}<div className="mono"
              style={{fontSize: 11, color: 'var(--ink3)'}}>{d.ref}</div></td>
            <td>{d.person}</td>
            <td className="mono" style={{color: 'var(--bad)'}}>{d.days} days late</td></tr>)}
        </tbody></table></div></div> : null}

      {byStage.length ? <div className="card"><div className="card-h"><h2>Leads by stage</h2></div>
        <div className="card-b"><Bars rows={byStage} labelKey="stage"/></div></div> : null}
    </div>
  </div>);
}
