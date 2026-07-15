"use client";

import View from "@/views/Invoices";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AppLayout } from "@/components/AppLayout";

export default function InvoicesImpl() {
  return (
    <ProtectedRoute>
      <AppLayout>
        <View />
      </AppLayout>
    </ProtectedRoute>
  );
}
