"use client";

import { Navigate, useLocation } from "@/lib/router-compat";
import { ReactNode } from "react";
import { useAuth, hasRole, type StaffRole } from "@/lib/auth-context";

interface Props {
  children: ReactNode;
  roles?: StaffRole[];
}

export function ProtectedRoute({ children, roles }: Props) {
  const { user, profile, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="h-6 w-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  // Logged in but no staff_profiles row → blocked
  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="card-surface max-w-md w-full p-6 text-center">
          <h2 className="font-display text-xl text-navy mb-2">Access Pending</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Your account isn't linked to a staff profile yet. Ask an owner to add you in HR / Team, or visit{" "}
            <a href="/setup" className="text-accent underline">/setup</a> if no owner exists yet.
          </p>
          <button
            onClick={() => { void import("@/integrations/supabase/client").then(m => m.supabase.auth.signOut()); }}
            className="text-sm text-primary underline"
          >
            Sign out
          </button>
        </div>
      </div>
    );
  }

  if (roles && !hasRole(profile, ...roles)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="card-surface max-w-md w-full p-6 text-center">
          <h2 className="font-display text-xl text-navy mb-2">Not authorised</h2>
          <p className="text-sm text-muted-foreground">
            Your role ({profile.role}) doesn't have access to this area.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
