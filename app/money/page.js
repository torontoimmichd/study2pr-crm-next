'use client';
import Link from 'next/link';
import {useScreen, Head, Loading, Failed, Waiting, Table, Stat} from '../../components/Screen';

export default function Money() {
  const {data, state, error, reload} = useScreen('money');
  if (state === 'loading') return <div className="page"><Loading/></div>;
  if (state === 'error') return <div className="page"><Failed error={error} retry={reload}/></div>;

  const invoices = data.invoices || [];
  const payments = data.payments || [];
  const fees = data.fees_defined || 0;

  return (<div className="page">
    <Head title="Money" sub="Fees, invoices and what has been paid.">
      <button className="tbtn" onClick={reload}>Refresh</button>
    </Head>

    <div className="grid g4" style={{marginBottom: 14}}>
      <Stat label="Fee schedules" value={fees} tone={fees ? undefined : 'warn'}/>
      <Stat label="Invoices" value={invoices.length}/>
      <Stat label="Payments" value={payments.length}/>
      <Stat label="Blocking submission" value={invoices.filter(i => i.blocks).length}
        tone={invoices.filter(i => i.blocks).length ? 'bad' : undefined}/>
    </div>

    {!fees ? <div className="advice" style={{marginBottom: 14}}>
      <div className="lbl">No fees defined</div>
      <p>Nothing can be invoiced until the fee for each route is recorded — your professional
        fee, the government fee, and which of them must be paid before a file can be submitted.
        That is the one thing this screen is waiting for.</p>
    </div> : null}

    {invoices.length
      ? <Table cols={['Invoice', 'Client', 'Total', 'Paid', 'Status', 'Due']} rows={invoices}
          empty="None." render={i => (<tr key={i.ref}>
            <td className="k mono">{i.ref}</td><td>{i.person}</td>
            <td className="mono">{i.currency} {i.total}</td>
            <td className="mono">{i.currency} {i.paid}</td>
            <td><span className={'tag ' + (i.blocks ? 't-bad' : 't-acc')}>
              {String(i.status).toUpperCase()}</span></td>
            <td className="mono">{i.due || '—'}</td></tr>)}/>
      : <Waiting source="invoices and payments" what="Nothing billed yet."
          next="Invoices appear here once a file is opened and a fee schedule exists."/>}
  </div>);
}
