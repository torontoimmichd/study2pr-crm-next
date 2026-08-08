"use client";

import View from "@/views/IrccTracker";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AppLayout } from "@/components/AppLayout";

export default function IrccTrackerImpl() {
  return <ProtectedRoute roles={["owner", "admin", "senior_advisor", "case_manager"]}><AppLayout><View /></AppLayout></ProtectedRoute>;
}
