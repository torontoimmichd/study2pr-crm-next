"use client";

// Settings has been consolidated into /admin — redirect there.
import { Navigate } from "@/lib/router-compat";
export default function Settings() { return <Navigate to="/admin" replace />; }
