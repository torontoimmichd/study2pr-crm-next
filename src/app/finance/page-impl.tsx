"use client";

import View from "@/views/Finance";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AppLayout } from "@/components/AppLayout";

export default function FinanceImpl() {
  return (
    <ProtectedRoute roles={["owner", "admin", "accountant"]}>
      <AppLayout>
        <View />
      </AppLayout>
    </ProtectedRoute>
  );
}
