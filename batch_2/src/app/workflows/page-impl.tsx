"use client";

import View from "@/views/Workflows";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AppLayout } from "@/components/AppLayout";

export default function WorkflowsImpl() {
  return (
    <ProtectedRoute roles={["owner", "admin", "senior_advisor"]}>
      <AppLayout>
        <View />
      </AppLayout>
    </ProtectedRoute>
  );
}
