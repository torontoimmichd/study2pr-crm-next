"use client";

import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface Props {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ icon, title, description, action, className }: Props) {
  return (
    <div className={cn("flex flex-col items-center justify-center text-center py-16 px-6", className)}>
      {icon && <div className="h-12 w-12 rounded-full bg-muted text-muted-foreground flex items-center justify-center mb-4">{icon}</div>}
      <h3 className="font-display text-lg text-navy">{title}</h3>
      {description && <p className="text-sm text-muted-foreground mt-1 max-w-sm">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
