"use client";

import View from "@/views/ManagerDigest";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AppLayout } from "@/components/AppLayout";

export default function ManagerDigestImpl() {
  return (
    <ProtectedRoute roles={["owner", "admin"]}>
      <AppLayout>
        <View />
      </AppLayout>
    </ProtectedRoute>
  );
}
