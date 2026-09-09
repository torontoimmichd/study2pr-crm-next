'use client';
import {createContext, useContext, useEffect, useState, useCallback} from 'react';
import {supabase, configured} from '../lib/supabase';

const Ctx = createContext(null);

/**
 * Four states this must represent, because three of them are real:
 *   loading  — we do not know yet
 *   anon     — nobody is signed in
 *   stranger — signed in, but this account has no member record, so no access
 *   member   — signed in and known
 * The third one is not hypothetical: the project has three auth users and one
 * member record. Two of them would otherwise land on a blank console.
 */
export function SessionProvider({children}) {
  const [state, setState] = useState(configured ? 'loading' : 'unconfigured');
  const [user, setUser] = useState(null);
  const [memberId, setMemberId] = useState(null);
  const [grants, setGrants] = useState([]);
  const [error, setError] = useState(null);

  const identify = useCallback(async (u) => {
    if (!u) { setUser(null); setMemberId(null); setGrants([]); setState('anon'); return; }
    setUser(u);
    try {
      const {data: me, error: meErr} = await supabase.rpc('fn_me');
      if (meErr) throw meErr;
      if (!me) { setMemberId(null); setState('stranger'); return; }
      setMemberId(me);
      const {data: g} = await supabase.rpc('fn_my_grants');
      setGrants(g ?? []);
      setState('member');
    } catch (e) {
      setError(e.message ?? 'Could not read your account.');
      setState('error');
    }
  }, []);

  useEffect(() => {
    if (!configured) return;
    let alive = true;
    supabase.auth.getSession().then(({data}) => {
      if (alive) identify(data?.session?.user ?? null);
    });
    const {data: sub} = supabase.auth.onAuthStateChange((_e, session) => {
      identify(session?.user ?? null);
    });
    return () => { alive = false; sub?.subscription?.unsubscribe(); };
  }, [identify]);

  const can = useCallback((resource, action) =>
    grants.some(g => g.resource === resource && g.action === action), [grants]);

  const signOut = useCallback(async () => { await supabase.auth.signOut(); }, []);

  return <Ctx.Provider value={{state, user, memberId, grants, can, error, signOut}}>
    {children}
  </Ctx.Provider>;
}

export function useSession() {
  return useContext(Ctx) ?? {state: 'loading', user: null, memberId: null, grants: [], can: () => false};
}
