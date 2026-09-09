'use client';
import {useScreen, Head, Loading, Failed, Waiting, Stat, Bars} from '../../components/Screen';

export default function Reports() {
  const {data, state, error, reload} = useScreen('reports');
  if (state === 'loading') return <div className="page"><Loading/></div>;
  if (state === 'error') return <div className="page"><Failed error={error} retry={reload}/></div>;

  const t = data.totals || {};
  const groups = [
    ['Where enquiries come from', data.by_source],
    ['What they ask for', data.by_category],
    ['Which country', data.by_country],
    ['Onshore or offshore', data.by_band],
  ].filter(g => (g[1] || []).length);

  return (<div className="page">
    <Head title="Reports" sub="Counted from the records themselves, not from a snapshot.">
      <button className="tbtn" onClick={reload}>Refresh</button>
    </Head>

    <div className="grid g4" style={{marginBottom: 14}}>
      <Stat label="Leads open" value={t.leads_open ?? 0}/>
      <Stat label="Leads all time" value={t.leads_all ?? 0}/>
      <Stat label="Assessments" value={t.assessments ?? 0}/>
      <Stat label="Rules live" value={(t.rules_live ?? 0) + ' of ' + (t.rules_total ?? 0)}
        tone={t.rules_live ? undefined : 'warn'}/>
    </div>

    {!groups.length
      ? <Waiting source="leads" what="Nothing to report on yet."
          next="These break down by source, service, country and whether the person is onshore — as soon as there are leads."/>
      : <div className="grid g2" style={{alignItems: 'start'}}>
          {groups.map(g => <div className="card" key={g[0]}>
            <div className="card-h"><h2>{g[0]}</h2></div>
            <div className="card-b"><Bars rows={g[1]}/></div></div>)}
        </div>}
  </div>);
}
