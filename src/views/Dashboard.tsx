"use client";

import { useAuth, hasRole } from "@/lib/auth-context";
import ExecutiveDashboard from "./ExecutiveDashboard";
import StaffDailyView from "./StaffDailyView";

/**
 * Role-aware dashboard router.
 * - Owner / Admin → ExecutiveDashboard (KPIs, pipeline, SLA, activity, at-risk cases)
 * - Everyone else → StaffDailyView (personal queue, calendar, commissions)
 */
export default function Dashboard() {
  const { profile } = useAuth();
  if (profile && hasRole(profile, "owner", "admin")) {
    return <ExecutiveDashboard />;
  }
  return <StaffDailyView />;
}
