"use client";

import View from "@/views/KnowledgeCanon";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AppLayout } from "@/components/AppLayout";

export default function KnowledgeCanonImpl() {
  return (
    <ProtectedRoute roles={["owner", "admin", "senior_advisor", "case_manager", "document_specialist", "support"]}>
      <AppLayout>
        <View />
      </AppLayout>
    </ProtectedRoute>
  );
}
