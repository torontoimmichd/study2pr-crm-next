"use client";

import View from "@/views/Settings";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AppLayout } from "@/components/AppLayout";

export default function SettingsImpl() {
  return (
    <ProtectedRoute roles={["owner", "admin"]}>
      <AppLayout>
        <View />
      </AppLayout>
    </ProtectedRoute>
  );
}
