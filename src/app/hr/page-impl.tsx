"use client";

import View from "@/views/HR";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AppLayout } from "@/components/AppLayout";

export default function HRImpl() {
  return (
    <ProtectedRoute roles={["owner", "admin"]}>
      <AppLayout>
        <View />
      </AppLayout>
    </ProtectedRoute>
  );
}
