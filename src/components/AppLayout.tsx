"use client";

import type { ReactNode } from "react";
import { AppSidebar, useSidebarPersistence } from "./AppSidebar";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { NotificationBell } from "./NotificationBell";
import { GlobalCreateFab } from "./GlobalCreateFab";

export function AppLayout({ children }: { children?: ReactNode }) {
  const [open, setOpen] = useSidebarPersistence();
  return (
    <SidebarProvider open={open} onOpenChange={setOpen}>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        <div className="flex-1 min-w-0 flex flex-col">
          {/* Top bar with hamburger trigger and notification bell */}
          <header className="h-12 flex items-center justify-between border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-20 px-2">
            <SidebarTrigger />
            <NotificationBell />
          </header>
          <main className="flex-1 min-w-0">
            {children}
          </main>
        </div>
      </div>
      {/* Global floating create button — available on every page */}
      <GlobalCreateFab />
    </SidebarProvider>
  );
}

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

export function PageHeader({ title, subtitle, actions }: PageHeaderProps) {
  return (
    <div className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-12 z-10">
      <div className="px-6 py-4 flex items-center justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-display text-2xl text-navy leading-tight truncate">{title}</h1>
          {subtitle && <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>}
        </div>
        {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
      </div>
    </div>
  );
}
