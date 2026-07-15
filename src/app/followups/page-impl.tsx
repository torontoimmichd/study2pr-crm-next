"use client";

import View from "@/views/FollowupIntegrity";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AppLayout } from "@/components/AppLayout";

export default function FollowupIntegrityImpl() {
  return (
    <ProtectedRoute roles={["owner", "admin", "senior_advisor"]}>
      <AppLayout>
        <View />
      </AppLayout>
    </ProtectedRoute>
  );
}
