"use client";

import { PageHeader } from "@/components/AppLayout";
import { Construction } from "lucide-react";

export interface ComingSoonProps {
  title: string;
  description?: string;
}

export function ComingSoon({ title, description }: ComingSoonProps) {
  return (
    <div>
      <PageHeader title={title} />
      <div className="p-6">
        <div className="card-surface p-12 text-center">
          <div className="h-12 w-12 rounded-full bg-muted text-muted-foreground flex items-center justify-center mx-auto mb-4">
            <Construction className="h-5 w-5" />
          </div>
          <h2 className="font-display text-xl text-navy mb-2">{title}</h2>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            {description ?? "Coming in Phase 2. The data model is ready in Supabase — we'll wire up the UI next."}
          </p>
        </div>
      </div>
    </div>
  );
}

export default ComingSoon;
