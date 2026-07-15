"use client";

import dynamicImport from "next/dynamic";

const PageImpl = dynamicImport(() => import("./page-impl"), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="h-6 w-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
    </div>
  ),
});

export default function PageClient() {
  return <PageImpl />;
}
