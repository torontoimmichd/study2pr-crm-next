"use client";

import View from "@/views/Inbox";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AppLayout } from "@/components/AppLayout";

export default function InboxImpl() {
  return (
    <ProtectedRoute roles={["owner", "admin", "senior_advisor", "case_manager"]}>
      <AppLayout>
        <View />
      </AppLayout>
    </ProtectedRoute>
  );
}
