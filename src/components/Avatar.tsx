"use client";

import { initials } from "@/lib/format";
import { cn } from "@/lib/utils";

interface Props {
  name: string | null | undefined;
  className?: string;
  size?: "sm" | "md" | "lg";
}

const SIZE = {
  sm: "h-6 w-6 text-[10px]",
  md: "h-8 w-8 text-xs",
  lg: "h-10 w-10 text-sm",
};

export function Avatar({ name, className, size = "md" }: Props) {
  return (
    <div
      className={cn(
        "rounded-full bg-navy/10 text-navy flex items-center justify-center font-medium shrink-0",
        SIZE[size],
        className,
      )}
      title={name ?? undefined}
    >
      {initials(name)}
    </div>
  );
}
