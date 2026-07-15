"use client";

import View from "@/views/Dashboard";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AppLayout } from "@/components/AppLayout";

export default function DashboardImpl() {
  return (
    <ProtectedRoute>
      <AppLayout>
        <View />
      </AppLayout>
    </ProtectedRoute>
  );
}
