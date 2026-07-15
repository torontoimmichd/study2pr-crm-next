"use client";

import View from "@/views/manager/ManagerDashboardPage";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AppLayout } from "@/components/AppLayout";

export default function ManagerDashboardPageImpl() {
  return (
    <ProtectedRoute roles={["owner", "admin"]}>
      <AppLayout>
        <View />
      </AppLayout>
    </ProtectedRoute>
  );
}
