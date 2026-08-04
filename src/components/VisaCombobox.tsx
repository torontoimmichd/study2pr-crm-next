"use client";

/**
 * VisaCombobox — type-to-search picker for visa types / streams.
 *
 * Replaces a plain <Select> where the list is long enough that scrolling is
 * painful. Start typing and the list filters; pick with mouse or keyboard.
 *
 * Built on the Command (cmdk) + Popover primitives that already ship in this
 * repo — no new npm dependency.
 *
 * Filtering note: cmdk matches on each item's `value`, so we pass the LABEL as
 * the value (that is what the user types) and carry the id through the closure.
 * Labels can repeat across categories, so each item's key stays the id.
 */

import { useMemo, useState } from "react";
import { Check, ChevronsUpDown, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";

export interface VisaOption {
  id: string;
  label: string;
  /** optional second line, e.g. the parent category or country */
  hint?: string | null;
}

interface Props {
  options: VisaOption[];
  value: string;
  onChange: (id: string) => void;
  placeholder?: string;
  emptyText?: string;
  searchPlaceholder?: string;
  disabled?: boolean;
  /** shows a small "auto-filled" marker when the value came from the primary applicant */
  inherited?: boolean;
  /** height/size tweaks for compact rows (family member cards) */
  size?: "sm" | "md";
  className?: string;
}

export function VisaCombobox({
  options,
  value,
  onChange,
  placeholder = "Select…",
  emptyText = "No match.",
  searchPlaceholder = "Type to search…",
  disabled = false,
  inherited = false,
  size = "md",
  className,
}: Props) {
  const [open, setOpen] = useState(false);

  const selected = useMemo(
    () => options.find((o) => o.id === value) ?? null,
    [options, value],
  );

  const h = size === "sm" ? "h-8 text-sm" : "h-10 text-sm";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "w-full justify-between font-normal px-3",
            h,
            !selected && "text-muted-foreground",
            className,
          )}
        >
          <span className="truncate text-left">
            {selected ? selected.label : placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command
          filter={(itemValue, search) =>
            itemValue.toLowerCase().includes(search.toLowerCase()) ? 1 : 0
          }
        >
          <div className="flex items-center border-b border-border px-2">
            <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <CommandInput
              placeholder={searchPlaceholder}
              className="h-9 border-0 focus:ring-0"
            />
          </div>
          <CommandList className="max-h-64">
            <CommandEmpty className="py-4 text-center text-xs text-muted-foreground">
              {emptyText}
            </CommandEmpty>
            <CommandGroup>
              {options.map((o) => (
                <CommandItem
                  key={o.id}
                  value={o.label}
                  onSelect={() => {
                    onChange(o.id === value ? "" : o.id);
                    setOpen(false);
                  }}
                  className="cursor-pointer"
                >
                  <Check
                    className={cn(
                      "mr-2 h-3.5 w-3.5 shrink-0",
                      o.id === value ? "opacity-100" : "opacity-0",
                    )}
                  />
                  <span className="min-w-0">
                    <span className="block truncate">{o.label}</span>
                    {o.hint ? (
                      <span className="block text-[10px] text-muted-foreground truncate">{o.hint}</span>
                    ) : null}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

/** Small inline marker for fields pre-filled from the primary applicant. */
export function InheritedHint({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <span className="text-[10px] text-muted-foreground ml-1 font-normal">
      (auto-filled — change if different)
    </span>
  );
}
