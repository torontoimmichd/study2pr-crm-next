"use client";

import dynamicImport from "next/dynamic";
import type { ReactNode } from "react";

const AdminShell = dynamicImport(() => import("./admin-shell"), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="h-6 w-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
    </div>
  ),
});

export default function AdminSegmentLayout({ children }: { children: ReactNode }) {
  return <AdminShell>{children}</AdminShell>;
}
