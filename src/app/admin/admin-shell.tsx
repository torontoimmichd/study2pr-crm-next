"use client";

import type { ReactNode } from "react";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AppLayout } from "@/components/AppLayout";
import { AdminLayout } from "@/components/AdminLayout";

export default function AdminShell({ children }: { children: ReactNode }) {
  return (
    <ProtectedRoute roles={["owner", "admin"]}>
      <AppLayout>
        <AdminLayout>{children}</AdminLayout>
      </AppLayout>
    </ProtectedRoute>
  );
}
