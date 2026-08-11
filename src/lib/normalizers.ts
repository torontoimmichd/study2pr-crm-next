export function uuidOrNull(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === "string" && value.trim() === "") return null;
  return value as string;
}

export function dateOrNull(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === "string" && value.trim() === "") return null;
  return value as string;
}
