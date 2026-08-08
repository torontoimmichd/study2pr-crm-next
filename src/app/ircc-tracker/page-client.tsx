"use client";

import dynamicImport from "next/dynamic";

const PageImpl = dynamicImport(() => import("./page-impl"), { ssr: false });
export default function PageClient() { return <PageImpl />; }
