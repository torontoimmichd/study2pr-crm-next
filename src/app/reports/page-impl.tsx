"use client";

import View from "@/views/Reports";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AppLayout } from "@/components/AppLayout";

export default function ReportsImpl() {
  return (
    <ProtectedRoute roles={["owner", "admin", "senior_advisor"]}>
      <AppLayout>
        <View />
      </AppLayout>
    </ProtectedRoute>
  );
}
