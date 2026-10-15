/** A key's optional expiry: the end of the chosen day (`YYYY-MM-DD`), as the moment the API takes; none for no day. */
export function expiryOf(day: string | null | undefined): string | null {
  if (!day) return null;
  const [year, month, date] = day.split("-").map(Number);
  if (!year || !month || !date) return null;
  return new Date(year, month - 1, date, 23, 59, 59).toISOString();
}

/** Today as the date field takes it (`YYYY-MM-DD`), on the clock of the person. */
export function todayOf(now: Date = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}
