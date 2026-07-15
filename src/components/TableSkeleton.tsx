"use client";

import { cn } from "@/lib/utils";

interface Props {
  rows?: number;
  cols?: number;
  className?: string;
}

export function TableSkeleton({ rows = 6, cols = 5, className }: Props) {
  return (
    <div className={cn("space-y-2 p-4", className)}>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex gap-3">
          {Array.from({ length: cols }).map((_, c) => (
            <div
              key={c}
              className="h-4 bg-muted rounded animate-pulse"
              style={{ flex: c === 0 ? 2 : 1 }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
