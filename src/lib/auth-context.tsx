"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type StaffRole =
  | "owner"
  | "admin"
  | "senior_advisor"
  | "case_manager"
  | "document_specialist"
  | "support"
  | "accountant";

export interface StaffProfile {
  id: string;
  full_name: string;
  email: string;
  role: StaffRole;
  phone: string | null;
  visa_specialties: string[] | null;
  is_active: boolean | null;
}

interface AuthState {
  user: User | null;
  session: Session | null;
  profile: StaffProfile | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthCtx = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<StaffProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = async (uid: string) => {
    const { data, error } = await supabase
      .from("staff_profiles")
      .select("id, full_name, email, role, phone, visa_specialties, is_active")
      .eq("id", uid)
      .maybeSingle();
    if (error) {
      // eslint-disable-next-line no-console
      console.warn("[auth] profile load error", error.message);
      setProfile(null);
      return;
    }
    setProfile((data as StaffProfile) ?? null);
  };

  useEffect(() => {
    // 1. set up listener FIRST
    const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => {
      setSession(sess);
      setUser(sess?.user ?? null);
      if (sess?.user) {
        // defer to avoid deadlock
        setTimeout(() => { void loadProfile(sess.user.id); }, 0);
      } else {
        setProfile(null);
      }
    });

    // 2. then read existing session
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        void loadProfile(s.user.id).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setProfile(null);
  };

  const refreshProfile = async () => {
    if (user?.id) await loadProfile(user.id);
  };

  return (
    <AuthCtx.Provider value={{ user, session, profile, loading, signOut, refreshProfile }}>
      {children}
    </AuthCtx.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}

export function hasRole(profile: StaffProfile | null, ...roles: StaffRole[]): boolean {
  if (!profile) return false;
  return roles.includes(profile.role);
}
