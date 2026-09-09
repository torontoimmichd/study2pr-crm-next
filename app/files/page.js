'use client';
import Link from 'next/link';
import {useScreen, Head, Loading, Failed, Waiting, Table} from '../../components/Screen';

export default function Files() {
  const {data, state, error, reload} = useScreen('files');
  if (state === 'loading') return <div className="page"><Loading/></div>;
  if (state === 'error') return <div className="page"><Failed error={error} retry={reload}/></div>;
  const rows = data.rows || [];

  return (<div className="page">
    <Head title="Files" sub="A file is opened when a lead converts. It holds the applications.">
      <button className="tbtn" onClick={reload}>Refresh</button>
    </Head>

    {!rows.length
      ? <Waiting source="matters and applications" what="No files open."
          next={<>Nothing converts a lead into a file yet — that is the next build.
            Until then, work happens on the <Link href="/leads">lead</Link>.</>}/>
      : <Table cols={['Reference', 'File', 'Client', 'Status', 'Applications', 'Owner', 'Next action']}
          rows={rows} empty="No files." render={r => (<tr key={r.ref}>
            <td className="k mono">{r.ref}</td><td>{r.name}</td><td>{r.person}</td>
            <td><span className="tag t-acc">{String(r.status).toUpperCase()}</span></td>
            <td className="mono">{r.applications}</td><td>{r.owner}</td><td>{r.next}</td></tr>)}/>}
  </div>);
}
