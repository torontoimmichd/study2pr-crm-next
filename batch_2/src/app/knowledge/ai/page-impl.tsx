"use client";

import View from "@/views/KnowledgeAI";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AppLayout } from "@/components/AppLayout";

export default function KnowledgeAIImpl() {
  return (
    <ProtectedRoute roles={["owner", "admin", "senior_advisor", "case_manager", "document_specialist", "support"]}>
      <AppLayout>
        <View />
      </AppLayout>
    </ProtectedRoute>
  );
}
