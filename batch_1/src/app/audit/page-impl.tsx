"use client";

import View from "@/views/Audit";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AppLayout } from "@/components/AppLayout";

export default function AuditImpl() {
  return (
    <ProtectedRoute roles={["owner", "admin"]}>
      <AppLayout>
        <View />
      </AppLayout>
    </ProtectedRoute>
  );
}
