'use client';
import Link from 'next/link';
import {useEffect, useState, useCallback, useMemo} from 'react';
import {useStore} from '../../components/Store';
import {useToast} from '../../components/ui';

const KINDS = ['consultation', 'assessment', 'document_collection', 'biometrics',
               'medical', 'interview', 'signing', 'review', 'other'];
const STATUS = {
  scheduled: ['SCHEDULED', 't-acc'], confirmed: ['CONFIRMED', 't-ok'],
  completed: ['COMPLETED', 't-ok'], no_show: ['NO SHOW', 't-bad'],
  cancelled: ['CANCELLED', 't-mute'], rescheduled: ['RESCHEDULED', 't-warn'],
};
const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function iso(d) { return d.toISOString(); }
function ymd(d) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0')
    + '-' + String(d.getDate()).padStart(2, '0');
}

export default function Appointments() {
  const {leads, calendar, appointmentTypes, saveAppointmentType,
         bookAppointment, setAppointmentStatus} = useStore();
  const [month, setMonth] = useState(() => { const d = new Date(); d.setDate(1); d.setHours(0,0,0,0); return d; });
  const [rows, setRows] = useState([]);
  const [types, setTypes] = useState([]);
  const [state, setState] = useState('loading');
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(ymd(new Date()));
  const [busy, setBusy] = useState(false);
  const [toastNode, toast] = useToast();
  const [book, setBook] = useState({leadRef: '', typeId: '', time: '10:00', minutes: '', location: '', agenda: ''});
  const [newType, setNewType] = useState({name: '', kind: 'consultation', minutes: 30, location: '', reminderHours: 24});
  const [addingType, setAddingType] = useState(false);
  const [note, setNote] = useState({});

  const from = month;
  const to = useMemo(() => { const d = new Date(month); d.setMonth(d.getMonth() + 1); return d; }, [month]);

  const load = useCallback(async () => {
    setState('loading');
    try {
      const [c, t] = await Promise.all([calendar(iso(from), iso(to)), appointmentTypes()]);
      setRows(c); setTypes(t); setState('ready');
    } catch (e) { setError(e.message); setState('error'); }
  }, [calendar, appointmentTypes, from, to]);

  useEffect(() => { load(); }, [load]);

  // Monday-first grid covering the whole month.
  const grid = useMemo(() => {
    const first = new Date(month);
    const offset = (first.getDay() + 6) % 7;
    const start = new Date(first); start.setDate(first.getDate() - offset);
    return Array.from({length: 42}, (_, i) => {
      const d = new Date(start); d.setDate(start.getDate() + i);
      return {key: ymd(d), date: d, inMonth: d.getMonth() === month.getMonth()};
    });
  }, [month]);

  const byDay = useMemo(() => {
    const m = {};
    rows.forEach(r => { (m[r.day] = m[r.day] || []).push(r); });
    return m;
  }, [rows]);

  const dayRows = byDay[selected] || [];

  async function addType(e) {
    e.preventDefault();
    setBusy(true);
    try {
      setTypes(await saveAppointmentType(newType));
      setNewType({name: '', kind: 'consultation', minutes: 30, location: '', reminderHours: 24});
      setAddingType(false);
      toast('Type added', 'It can be booked straight away.');
    } catch (ex) { toast('Not saved', ex.message); }
    finally { setBusy(false); }
  }

  async function makeBooking(e) {
    e.preventDefault();
    if (!book.leadRef || !book.typeId) { toast('Missing', 'Pick a lead and an appointment type.'); return; }
    setBusy(true);
    try {
      const startsAt = new Date(selected + 'T' + book.time + ':00');
      await bookAppointment({
        leadRef: book.leadRef, typeId: book.typeId, startsAt: startsAt.toISOString(),
        minutes: book.minutes ? Number(book.minutes) : null,
        location: book.location, agenda: book.agenda,
      });
      setBook({leadRef: '', typeId: '', time: '10:00', minutes: '', location: '', agenda: ''});
      await load();
      toast('Booked', 'It is on the calendar, and a reminder is set for the client.');
    } catch (ex) { toast('Not booked', ex.message); }
    finally { setBusy(false); }
  }

  async function mark(id, status) {
    setBusy(true);
    try {
      await setAppointmentStatus(id, status, note[id] || null);
      setNote(n => Object.assign({}, n, {[id]: ''}));
      await load();
      toast('Recorded', 'The appointment is marked ' + status.replace('_', ' ') + '.');
    } catch (ex) { toast('Not saved', ex.message); }
    finally { setBusy(false); }
  }

  const monthLabel = month.toLocaleString('en-GB', {month: 'long', year: 'numeric'});
  const shift = n => { const d = new Date(month); d.setMonth(d.getMonth() + n); setMonth(d); };

  return (<div className="page">
    <div className="phead"><div><h1>Appointments</h1>
      <p className="sub">Real bookings against real leads. Every one sets a reminder and lands on the lead&rsquo;s timeline.</p></div>
      <span className="spacer"/>
      <button className="tbtn" onClick={() => shift(-1)}>&larr;</button>
      <span className="n mono" style={{minWidth: 130, textAlign: 'center'}}>{monthLabel}</span>
      <button className="tbtn" onClick={() => shift(1)}>&rarr;</button>
    </div>

    {error ? <div className="advice" style={{borderLeftColor: 'var(--bad)', marginBottom: 12}}>
      <div className="lbl" style={{color: 'var(--bad)'}}>Could not load the calendar</div><p>{error}</p></div> : null}

    {!types.length && state === 'ready' ? <div className="advice" style={{marginBottom: 12}}>
      <div className="lbl">No appointment types yet</div>
      <p>Nothing can be booked until you say what kinds of appointment you hold and how long
        each takes. Add the first one below — for example &ldquo;First consultation, 30 minutes&rdquo;.</p>
    </div> : null}

    <div className="grid g2" style={{alignItems: 'start'}}>
      <div className="card">
        <div className="card-h"><h2>{monthLabel}</h2><span className="spacer"/>
          <span className="n mono">{rows.length} booked</span></div>
        <div className="card-b">
          <div style={{display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 4}}>
            {DAY_NAMES.map(d => <div key={d} className="mono"
              style={{fontSize: 10.5, color: 'var(--ink3)', textAlign: 'center', padding: '2px 0'}}>{d}</div>)}
            {grid.map(g => {
              const items = byDay[g.key] || [];
              const isSel = g.key === selected;
              return (<button key={g.key} onClick={() => setSelected(g.key)}
                style={{textAlign: 'left', padding: '6px 6px 5px', minHeight: 58, cursor: 'pointer',
                  borderRadius: 8, fontFamily: 'inherit',
                  border: '1px solid ' + (isSel ? 'var(--f1)' : 'var(--line)'),
                  background: isSel ? 'rgba(96,165,250,.12)' : 'var(--panel2)',
                  opacity: g.inMonth ? 1 : .38, color: 'var(--ink)'}}>
                <div className="mono" style={{fontSize: 11, color: 'var(--ink3)'}}>{g.date.getDate()}</div>
                {items.slice(0, 2).map(i => <div key={i.id}
                  style={{fontSize: 10.5, marginTop: 2, whiteSpace: 'nowrap',
                    overflow: 'hidden', textOverflow: 'ellipsis'}}>
                  <span className="mono">{i.time}</span> {i.person || i.kind}</div>)}
                {items.length > 2 ? <div style={{fontSize: 10, color: 'var(--ink3)'}}>
                  +{items.length - 2} more</div> : null}
              </button>);
            })}
          </div>
          {state === 'loading' ? <p className="note">Loading…</p> : null}
        </div></div>

      <div>
        <div className="card" style={{marginBottom: 14}}>
          <div className="card-h"><h2>{selected}</h2><span className="spacer"/>
            <span className="n mono">{dayRows.length} on this day</span></div>
          <div className="card-b">
            {!dayRows.length ? <div className="empty">Nothing booked.</div>
              : dayRows.map(a => {
                const [text, tag] = STATUS[a.status] || [a.status.toUpperCase(), 't-mute'];
                return (<div key={a.id} style={{borderTop: '1px solid var(--line)', padding: '9px 0'}}>
                  <div style={{display: 'flex', gap: 8, alignItems: 'baseline'}}>
                    <span className="mono" style={{fontSize: 12.5}}>{a.time}–{a.ends}</span>
                    <b style={{fontSize: 13}}>{a.kind}</b><span className="spacer"/>
                    <span className={'tag ' + tag}>{text}</span></div>
                  <div style={{fontSize: 12.5, color: 'var(--ink2)'}}>
                    {a.lead ? <Link href={'/leads/' + a.lead}>{a.person}</Link> : a.person}
                    {a.location ? ' · ' + a.location : ''} · {a.minutes} min · {a.owner}</div>
                  {a.agenda ? <div style={{fontSize: 12, color: 'var(--ink3)'}}>{a.agenda}</div> : null}
                  {['scheduled', 'confirmed'].includes(a.status) ? <>
                    <input value={note[a.id] || ''} placeholder="Note (required to cancel or mark no-show)"
                      onChange={e => setNote(n => Object.assign({}, n, {[a.id]: e.target.value}))}
                      style={{marginTop: 6, width: '100%', background: 'var(--panel2)',
                        border: '1px solid var(--line)', borderRadius: 7, padding: '5px 8px',
                        fontSize: 12, fontFamily: 'inherit', color: 'var(--ink)'}}/>
                    <div style={{display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap'}}>
                      {a.status === 'scheduled'
                        ? <button className="tbtn" disabled={busy} onClick={() => mark(a.id, 'confirmed')}>Confirmed</button>
                        : null}
                      <button className="tbtn pri" disabled={busy} onClick={() => mark(a.id, 'completed')}>Attended</button>
                      <button className="tbtn" disabled={busy} onClick={() => mark(a.id, 'no_show')}>No show</button>
                      <button className="tbtn" disabled={busy} onClick={() => mark(a.id, 'cancelled')}>Cancel</button>
                    </div></> : null}
                </div>);
              })}
          </div></div>

        <div className="card" style={{marginBottom: 14}}>
          <div className="card-h"><h2>Book on {selected}</h2></div>
          <form onSubmit={makeBooking}><div className="card-b">
            <div className="form">
              <div className="fld"><label>Lead</label>
                <select value={book.leadRef} onChange={e => setBook(b => ({...b, leadRef: e.target.value}))}>
                  <option value="">{leads.length ? 'Choose a lead…' : 'No open leads yet'}</option>
                  {leads.map(l => <option key={l.id} value={l.id}>LEAD-{l.id} · {l.name}</option>)}</select></div>
              <div className="fld"><label>Type</label>
                <select value={book.typeId} onChange={e => setBook(b => ({...b, typeId: e.target.value}))}>
                  <option value="">{types.length ? 'Choose…' : 'Add a type first'}</option>
                  {types.map(t => <option key={t.id} value={t.id}>{t.name} · {t.minutes} min</option>)}</select></div>
              <div className="fld"><label>Time</label>
                <input type="time" value={book.time} onChange={e => setBook(b => ({...b, time: e.target.value}))}/></div>
              <div className="fld"><label>Minutes (optional)</label>
                <input type="number" value={book.minutes} placeholder="uses the type's length"
                  onChange={e => setBook(b => ({...b, minutes: e.target.value}))}/></div>
              <div className="fld"><label>Where</label>
                <input value={book.location} placeholder="Office · phone · video link"
                  onChange={e => setBook(b => ({...b, location: e.target.value}))}/></div>
            </div>
            <div className="fld" style={{marginTop: 8}}><label>Agenda</label>
              <textarea rows={2} value={book.agenda}
                onChange={e => setBook(b => ({...b, agenda: e.target.value}))}/></div>
            <div style={{marginTop: 10}}>
              <button className="tbtn pri" type="submit" disabled={busy || !types.length}>
                {busy ? 'Booking…' : 'Book it'}</button></div>
          </div></form></div>

        <div className="card">
          <div className="card-h"><h2>Appointment types</h2><span className="spacer"/>
            <button className="tbtn" onClick={() => setAddingType(!addingType)}>
              {addingType ? 'Cancel' : 'Add a type'}</button></div>
          <div className="card-b">
            {types.map(t => <div key={t.id} style={{display: 'flex', gap: 8, alignItems: 'baseline',
              borderTop: '1px solid var(--line)', padding: '6px 0'}}>
              <b style={{fontSize: 13}}>{t.name}</b>
              <span className="n mono">{t.minutes} min</span><span className="spacer"/>
              <span className="n mono">{t.location || '—'}</span></div>)}
            {!types.length && !addingType ? <div className="empty">None yet.</div> : null}

            {addingType ? <form onSubmit={addType} style={{marginTop: 8}}>
              <div className="form">
                <div className="fld"><label>Name</label>
                  <input value={newType.name} placeholder="First consultation"
                    onChange={e => setNewType(t => ({...t, name: e.target.value}))}/></div>
                <div className="fld"><label>Kind</label>
                  <select value={newType.kind} onChange={e => setNewType(t => ({...t, kind: e.target.value}))}>
                    {KINDS.map(k => <option key={k} value={k}>{k.replace(/_/g, ' ')}</option>)}</select></div>
                <div className="fld"><label>Minutes</label>
                  <input type="number" value={newType.minutes}
                    onChange={e => setNewType(t => ({...t, minutes: Number(e.target.value)}))}/></div>
                <div className="fld"><label>Remind client (hours before)</label>
                  <input type="number" value={newType.reminderHours}
                    onChange={e => setNewType(t => ({...t, reminderHours: Number(e.target.value)}))}/></div>
                <div className="fld"><label>Default location</label>
                  <input value={newType.location}
                    onChange={e => setNewType(t => ({...t, location: e.target.value}))}/></div>
              </div>
              <div style={{marginTop: 10}}>
                <button className="tbtn pri" type="submit" disabled={busy}>Save type</button></div>
            </form> : null}
          </div></div>
      </div>
    </div>
    {toastNode}</div>);
}
