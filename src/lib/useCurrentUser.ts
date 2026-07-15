"use client";

// Adapter hook so design-folder files that import useCurrentUser
// work against the existing useAuth context.
import { useAuth } from "@/lib/auth-context";

export function useCurrentUser() {
  const { profile } = useAuth();
  if (!profile) return null;
  return {
    id: profile.id,
    full_name: profile.full_name,
    role: profile.role,
    roles: [profile.role],
  };
}
