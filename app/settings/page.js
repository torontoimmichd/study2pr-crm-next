'use client';
import Link from 'next/link';
import {useScreen, Head, Loading, Failed, Table} from '../../components/Screen';

export default function Settings() {
  const {data, state, error, reload} = useScreen('settings');
  if (state === 'loading') return <div className="page"><Loading/></div>;
  if (state === 'error') return <div className="page"><Failed error={error} retry={reload}/></div>;

  const o = data.organisation || {};
  const me = data.me || {};

  return (<div className="page">
    <Head title="Settings" sub="The organisation, its branches and hours.">
      <button className="tbtn" onClick={reload}>Refresh</button>
    </Head>

    <div className="grid g2" style={{alignItems: 'start'}}>
      <div className="card"><div className="card-h"><h2>Organisation</h2></div>
        <div className="scrollx"><table className="tbl"><tbody>
          <tr><td className="k">Name</td><td>{o.name || '—'}</td></tr>
          <tr><td className="k">Legal name</td><td>{o.legal_name || '—'}</td></tr>
          <tr><td className="k">Currency</td><td>{o.currency || '—'}</td></tr>
          <tr><td className="k">Timezone</td><td>{o.timezone || '—'}</td></tr>
          <tr><td className="k">Quiet hours</td>
            <td>{o.quiet_from && o.quiet_to ? o.quiet_from + ' – ' + o.quiet_to : 'Not set'}</td></tr>
          <tr><td className="k">Holidays loaded</td><td className="mono">{data.holidays ?? 0}</td></tr>
        </tbody></table></div></div>

      <div className="card"><div className="card-h"><h2>You</h2></div>
        <div className="scrollx"><table className="tbl"><tbody>
          <tr><td className="k">Name</td><td>{me.name || '—'}</td></tr>
          <tr><td className="k">Roles</td><td>{me.roles || '—'}</td></tr>
          <tr><td className="k">Branch</td><td>{me.branch || '—'}</td></tr>
          <tr><td className="k">Job title</td><td>{me.job_title || '—'}</td></tr>
          <tr><td className="k">Can delete records</td>
            <td><span className={'tag ' + (me.is_owner ? 't-ok' : 't-mute')}>
              {me.is_owner ? 'YES — owner' : 'NO'}</span></td></tr>
        </tbody></table></div></div>
    </div>

    <h3 className="sec">Branches</h3>
    <Table cols={['Branch', 'City', 'Country', 'Timezone', 'Active']} rows={data.branches || []}
      empty="No branches." render={(b, i) => (<tr key={i}>
        <td className="k">{b.name}</td><td>{b.city || '—'}</td><td>{b.country || '—'}</td>
        <td className="mono">{b.timezone || '—'}</td>
        <td><span className={'tag ' + (b.active ? 't-ok' : 't-mute')}>
          {b.active ? 'YES' : 'NO'}</span></td></tr>)}/>

    <h3 className="sec">Office hours</h3>
    <Table cols={['Day', 'Opens', 'Closes']} rows={data.office_hours || []}
      empty="Not set." render={(h, i) => (<tr key={i}>
        <td className="k">{['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][h.day] || h.day}</td>
        <td className="mono">{h.opens}</td><td className="mono">{h.closes}</td></tr>)}/>

    <p className="note">Everything you configure — countries, categories, workflows, rules,
      documents, clocks — lives in the <Link href="/control-centre">Control Centre</Link>.</p>
  </div>);
}
