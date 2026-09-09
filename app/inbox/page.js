'use client';
import Link from 'next/link';
import {useScreen, Head, Loading, Failed, Waiting, Table} from '../../components/Screen';

export default function Inbox() {
  const {data, state, error, reload} = useScreen('inbox');
  if (state === 'loading') return <div className="page"><Loading/></div>;
  if (state === 'error') return <div className="page"><Failed error={error} retry={reload}/></div>;

  const rows = data.rows || [];
  const templates = data.templates || 0;

  return (<div className="page">
    <Head title="Inbox" sub="Client conversations, kept against the lead they belong to.">
      <button className="tbtn" onClick={reload}>Refresh</button>
    </Head>

    {!rows.length
      ? <Waiting source="communication_threads and messages" what="No conversations yet."
          next={<>Messages are recorded here once a channel is connected. {templates} message
            template{templates === 1 ? '' : 's'} defined so far — the wording lives in the
            Control Centre, so nobody rewrites it each time.</>}/>
      : <Table cols={['Person', 'Subject', 'Channel', 'Messages', 'Last', 'Status']}
          rows={rows} empty="Nothing." render={t => (<tr key={t.id}>
            <td className="k">{t.lead ? <Link href={'/leads/' + t.lead}>{t.person}</Link> : t.person}</td>
            <td>{t.subject}</td><td>{t.channel}</td>
            <td className="mono">{t.messages}</td><td className="mono">{t.last || '—'}</td>
            <td><span className={'tag ' + (t.unread ? 't-warn' : 't-mute')}>
              {t.unread ? 'UNREAD' : String(t.status).toUpperCase()}</span></td></tr>)}/>}
  </div>);
}
