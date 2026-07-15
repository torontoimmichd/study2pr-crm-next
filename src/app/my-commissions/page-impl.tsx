"use client";

import View from "@/views/MyCommissions";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AppLayout } from "@/components/AppLayout";

export default function MyCommissionsImpl() {
  return (
    <ProtectedRoute>
      <AppLayout>
        <View />
      </AppLayout>
    </ProtectedRoute>
  );
}
