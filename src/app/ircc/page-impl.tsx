"use client";

import View from "@/views/IRCCInbox";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AppLayout } from "@/components/AppLayout";

export default function IRCCInboxImpl() {
  return (
    <ProtectedRoute roles={["owner", "admin", "senior_advisor", "case_manager"]}>
      <AppLayout>
        <View />
      </AppLayout>
    </ProtectedRoute>
  );
}
