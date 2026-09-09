'use client';
import {useState, useEffect} from 'react';
import Link from 'next/link';
import {useStore} from '../../../components/Store';
import {ReferralPicker} from '../../../components/ReferralPicker';

const STATUSES = ['Citizen at home', 'Student abroad', 'Worker abroad', 'Visitor abroad',
                  'Permit expiring', 'Other'];

export default function NewLead() {
  const {addLead, loadCatalogue, findByPhone, leadSourceOptions, setLeadReferral} = useStore();
  const [cat, setCat] = useState({categories: [], countries: [], origin_countries: [],
                                  bloc_members: {}, sources: []});
  const [state, setState] = useState('loading');
  const [v, setV] = useState({name: '', phone: '', email: '', category: '', subcategory: '',
    country: '', blocCountry: '', passportCountry: 'India', currentCountry: 'India',
    status: STATUSES[0], timeline: '', source: ''});
  const [err, setErr] = useState({});
  const [failed, setFailed] = useState(null);
  const [busy, setBusy] = useState(false);
  const [made, setMade] = useState(null);
  const [sourceOpts, setSourceOpts] = useState([]);
  const [referral, setReferral] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const [c, so] = await Promise.all([loadCatalogue(), leadSourceOptions()]);
        setCat(c); setSourceOpts(so); setState('ready');
      }
      catch (e) { setFailed(e.message); setState('error'); }
    })();
  }, [loadCatalogue, leadSourceOptions]);

  const subs = (cat.categories || []).find(c => c.code === v.category)?.subcategories || [];
  // Some sources are a who: a past client, or a partner. The source itself says which.
  const linkKind = (sourceOpts.find(s => s.name === v.source) || {}).link_kind || 'none';
  const blocOf = cat.bloc_members?.[v.country] || null;   // Schengen → its members
  const dupe = findByPhone(v.phone);

  // Where the person is now, against where they are going — the same three
  // bands the database computes, previewed here so it is not a surprise.
  const destination = v.blocCountry || v.country;
  const band = !v.currentCountry ? null
    : v.currentCountry === destination ? ['ONSHORE', 't-ok', 'Already in the destination country']
    : v.currentCountry === v.passportCountry ? ['HOME', 't-acc', 'Living in their own passport country']
    : ['THIRD COUNTRY', 't-warn', 'Living somewhere that is neither'];

  function set(k, val) {
    setV(x => {
      const next = Object.assign({}, x, {[k]: val});
      if (k === 'category') next.subcategory = '';
      if (k === 'country') next.blocCountry = '';
      if (k === 'source') setReferral(null);
      return next;
    });
  }

  async function submit(e) {
    e.preventDefault();
    setFailed(null);
    const required = ['name', 'phone', 'category', 'subcategory', 'country',
                      'passportCountry', 'currentCountry', 'source'];
    const m = {};
    required.forEach(k => { if (!String(v[k] || '').trim()) m[k] = 1; });
    if (blocOf && !v.blocCountry) m.blocCountry = 1;
    if (linkKind !== 'none' && !referral) m.referral = 1;
    setErr(m);
    if (Object.keys(m).length) return;
    setBusy(true);
    try {
      const lead = await addLead(Object.assign({}, v, {country: v.blocCountry || v.country}));
      if (referral) {
        try {
          await setLeadReferral(lead.id, linkKind === 'partner'
            ? {partner: referral.id} : {person: referral.id});
        } catch (ex) {
          // The enquiry is saved either way; say what did not stick rather than
          // pretending the whole thing failed.
          setFailed('The enquiry was created, but who referred them was not recorded: ' + ex.message);
        }
      }
      setMade(lead);
    }
    catch (ex) { setFailed(ex.message); }
    finally { setBusy(false); }
  }

  if (state === 'loading') return <div className="page"><div className="empty">Loading the catalogue…</div></div>;

  if (made) return (<div className="page">
    <div className="phead"><div><span className="tag t-ok">LEAD CREATED</span>
      <h1 style={{marginTop: 7}}>{made.name}</h1>
      <p className="sub">LEAD-{made.id} · {made.interest} · owned by {made.owner}</p></div>
      <span className="spacer"/>
      <button className="tbtn" onClick={() => { setMade(null);
        setV(Object.assign({}, v, {name: '', phone: '', email: '', timeline: ''})); }}>Add another</button>
      <Link className="tbtn pri" href={'/leads/' + made.id}>Open the lead</Link></div>
    <div className="card"><div className="scrollx"><table className="tbl"><tbody>
      <tr><td className="k">Service</td><td>{[made.category, made.subcategory].filter(Boolean).join(' · ')}</td>
        <td><span className="tag t-ok">SAVED</span></td></tr>
      <tr><td className="k">Destination</td><td>{made.country}</td>
        <td><span className="tag t-ok">SAVED</span></td></tr>
      <tr><td className="k">Where they are</td><td>{[made.passport, made.residence].filter(Boolean).join(' → ')}</td>
        <td><span className={'tag ' + (made.band === 'onshore' ? 't-ok' : made.band === 'home' ? 't-acc' : 't-warn')}>
          {String(made.band || '').toUpperCase()}</span></td></tr>
      <tr><td className="k">Stage</td><td>{made.stage} · {made.next}</td>
        <td><span className="tag t-acc">STARTED</span></td></tr>
    </tbody></table></div></div></div>);

  const F = ({k, label, children}) => (
    <div className={'fld' + (err[k] ? ' bad' : '')}>
      <label htmlFor={k}>{label}</label>
      {children}
      {err[k] ? <div className="hint" style={{color: 'var(--bad)'}}>Required</div> : null}
    </div>);

  return (<div className="page">
    <div className="phead"><div><h1>New lead</h1>
      <p className="sub">Category and country decide the workflow. Passport and residence decide
        whether this is an onshore or offshore file.</p></div></div>

    {dupe ? <div className="advice" style={{borderLeftColor: 'var(--warn)'}}>
      <div className="lbl" style={{color: 'var(--warn)'}}>Possible duplicate</div>
      <p><b>{dupe.name} already has a lead with that phone number</b> (LEAD-{dupe.id}, {dupe.stage}).
        One open lead per person is allowed, so this will be refused until that one is closed.</p>
    </div> : null}

    {failed ? <div className="advice" style={{borderLeftColor: 'var(--bad)'}}>
      <div className="lbl" style={{color: 'var(--bad)'}}>Not saved</div><p>{failed}</p></div> : null}

    <form onSubmit={submit}>
      <div className="card" style={{marginBottom: 14}}>
        <div className="card-h"><h2>Who</h2></div>
        <div className="card-b"><div className="form">
          <F k="name" label="Full name">
            <input id="name" value={v.name} onChange={e => set('name', e.target.value)}/></F>
          <F k="phone" label="Phone / WhatsApp">
            <input id="phone" type="tel" value={v.phone} onChange={e => set('phone', e.target.value)}/></F>
          <F k="email" label="Email">
            <input id="email" type="email" value={v.email} onChange={e => set('email', e.target.value)}/></F>
          <F k="source" label="How they heard of us">
            <select id="source" value={v.source} onChange={e => set('source', e.target.value)}>
              <option value="">Choose…</option>
              {sourceOpts.map(s => <option key={s.name} value={s.name}>{s.name}</option>)}</select></F>
          {linkKind !== 'none'
            ? <ReferralPicker kind={linkKind} value={referral} onChange={setReferral}
                invalid={!!err.referral}/>
            : null}
        </div></div></div>

      <div className="card" style={{marginBottom: 14}}>
        <div className="card-h"><h2>What they want</h2></div>
        <div className="card-b"><div className="form">
          <F k="category" label="Category">
            <select id="category" value={v.category} onChange={e => set('category', e.target.value)}>
              <option value="">Choose…</option>
              {(cat.categories || []).map(c => <option key={c.code} value={c.code}>{c.name}</option>)}</select></F>
          <F k="subcategory" label="Sub-category">
            <select id="subcategory" value={v.subcategory} disabled={!v.category}
              onChange={e => set('subcategory', e.target.value)}>
              <option value="">{v.category ? 'Choose…' : 'Pick a category first'}</option>
              {subs.map(s => <option key={s.code} value={s.code}>{s.name}</option>)}</select></F>
          <F k="country" label="Destination">
            <select id="country" value={v.country} onChange={e => set('country', e.target.value)}>
              <option value="">Choose…</option>
              {(cat.countries || []).map(c => <option key={c.name}>{c.name}</option>)}</select></F>
          {blocOf ? <F k="blocCountry" label="Which country">
            <select id="blocCountry" value={v.blocCountry} onChange={e => set('blocCountry', e.target.value)}>
              <option value="">Choose…</option>
              {blocOf.map(c => <option key={c}>{c}</option>)}</select></F> : null}
          <F k="timeline" label="Intended intake or timeline">
            <input id="timeline" value={v.timeline} placeholder="e.g. January 2027"
              onChange={e => set('timeline', e.target.value)}/></F>
        </div></div></div>

      <div className="card">
        <div className="card-h"><h2>Where they are</h2><span className="spacer"/>
          {band ? <span className={'tag ' + band[1]} title={band[2]}>{band[0]}</span> : null}</div>
        <div className="card-b"><div className="form">
          <F k="passportCountry" label="Passport country">
            <select id="passportCountry" value={v.passportCountry}
              onChange={e => set('passportCountry', e.target.value)}>
              <option value="">Choose…</option>
              {(cat.origin_countries || []).map(c => <option key={c}>{c}</option>)}</select></F>
          <F k="currentCountry" label="Country of residence">
            <select id="currentCountry" value={v.currentCountry}
              onChange={e => set('currentCountry', e.target.value)}>
              <option value="">Choose…</option>
              {(cat.origin_countries || []).map(c => <option key={c}>{c}</option>)}</select></F>
          <F k="status" label="Current status">
            <select id="status" value={v.status} onChange={e => set('status', e.target.value)}>
              {STATUSES.map(s => <option key={s}>{s}</option>)}</select></F>
        </div>
        {band ? <p className="note">{band[2]}. This shows on every screen so onshore and offshore
          files are told apart at a glance.</p> : null}
        </div></div>

      <div style={{display: 'flex', gap: 9, marginTop: 14, alignItems: 'center', flexWrap: 'wrap'}}>
        <button type="submit" className="tbtn pri" disabled={busy}>{busy ? 'Saving…' : 'Create lead'}</button>
        <Link href="/leads" className="tbtn">Cancel</Link>
        <span className="note" style={{marginTop: 0}}>Saves the person and the lead in one transaction,
          starts it at New on the default workflow, and sets the two-hour contact clock.</span>
      </div>
    </form></div>);
}
