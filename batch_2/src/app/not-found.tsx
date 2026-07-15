"use client";

import { Suspense } from "react";
import dynamicImport from "next/dynamic";

const NotFoundView = dynamicImport(() => import("@/views/NotFound"), { ssr: false });

export default function NotFound() {
  return (
    <Suspense fallback={null}>
      <NotFoundView />
    </Suspense>
  );
}
