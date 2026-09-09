'use client';
import {useEffect, useState} from 'react';
import {useParams, useRouter} from 'next/navigation';
import {supabase} from '../../../lib/supabase';
import {useSession} from '../../../components/Session';

/**
 * Accepting an invitation. The link carries a token; the database checks it
 * against the signed-in email and refuses if they do not match, so this page
 * only has to show whatever it said.
 */
export default function AcceptInvite() {
  const {token} = useParams();
  const router = useRouter();
  const {state, user} = useSession();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (state === 'anon') return;
    if (state !== 'stranger' && state !== 'member') return;
    let alive = true;
    (async () => {
      setBusy(true);
      const {error: e} = await supabase.rpc('fn_accept_invitation', {p_token: token});
      if (!alive) return;
      if (e) setError(e.message); else setDone(true);
      setBusy(false);
    })();
    return () => { alive = false; };
  }, [state, token]);

  useEffect(() => {
    if (!done) return;
    const h = setTimeout(() => router.push('/'), 1400);
    return () => clearTimeout(h);
  }, [done, router]);

  return (<div className="gate-wrap"><div className="gate-card">
    <div className="gate-h"><div className="gate-brand">Study2PR</div></div>

    {state === 'loading' || busy
      ? <p className="gate-sub">Checking your invitation…</p>

      : state === 'anon'
      ? <p className="gate-sub">Sign in with the email address this invitation was sent to,
          then open this link again.</p>

      : error
      ? <><div className="gate-err">{error}</div>
          <p className="gate-sub">Signed in as {user?.email}.</p></>

      : done
      ? <p className="gate-sub">You are in. Taking you to the console…</p>

      : <p className="gate-sub">Nothing to do with this link.</p>}
  </div></div>);
}
