import { format, formatDistanceToNow } from "date-fns";

const IST = "Asia/Kolkata";

export function fmtDateIST(value: string | Date | null | undefined, pattern = "dd MMM yyyy") {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  if (isNaN(d.getTime())) return "—";
  // date-fns doesn't TZ-shift, so we rebuild in IST
  const ist = new Date(d.toLocaleString("en-US", { timeZone: IST }));
  return format(ist, pattern);
}

export function fmtDateTimeIST(value: string | Date | null | undefined) {
  return fmtDateIST(value, "dd MMM yyyy, HH:mm");
}

export function fmtRelative(value: string | Date | null | undefined) {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  if (isNaN(d.getTime())) return "—";
  return formatDistanceToNow(d, { addSuffix: true });
}

export function fmtMoney(amount: number | null | undefined, currency = "INR") {
  if (amount == null) return "—";
  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toLocaleString()}`;
  }
}

export function initials(name: string | null | undefined) {
  if (!name) return "??";
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("") || "??";
}
