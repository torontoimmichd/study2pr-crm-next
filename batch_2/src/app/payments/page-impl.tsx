"use client";

import View from "@/views/Payments";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AppLayout } from "@/components/AppLayout";

export default function PaymentsImpl() {
  return (
    <ProtectedRoute>
      <AppLayout>
        <View />
      </AppLayout>
    </ProtectedRoute>
  );
}
