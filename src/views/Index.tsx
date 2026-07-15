"use client";

import { Navigate } from "@/lib/router-compat";

// The app entry redirects to the dashboard; real routing lives in App.tsx.
const Index = () => <Navigate to="/dashboard" replace />;

export default Index;
