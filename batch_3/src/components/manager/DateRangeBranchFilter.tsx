"use client";

// src/components/manager/DateRangeBranchFilter.tsx
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export type DateRange = "7d" | "30d" | "90d";

interface Props {
  dateRange: DateRange;
  onDateRangeChange: (v: DateRange) => void;
  branchFilter: string[];
  onBranchFilterChange: (v: string[]) => void;
}

export function DateRangeBranchFilter({ dateRange, onDateRangeChange, branchFilter, onBranchFilterChange }: Props) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <Select value={dateRange} onValueChange={v => onDateRangeChange(v as DateRange)}>
        <SelectTrigger className="w-32 h-8 text-sm"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="7d">Last 7 days</SelectItem>
          <SelectItem value="30d">Last 30 days</SelectItem>
          <SelectItem value="90d">Last 90 days</SelectItem>
        </SelectContent>
      </Select>
      <Select
        value={branchFilter[0] || "all"}
        onValueChange={v => onBranchFilterChange(v === "all" ? [] : [v])}
      >
        <SelectTrigger className="w-40 h-8 text-sm"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All branches</SelectItem>
          <SelectItem value="IND-CHD">IND-CHD</SelectItem>
          <SelectItem value="IND-LDH">IND-LDH</SelectItem>
          <SelectItem value="CAN-TOR">CAN-TOR</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
