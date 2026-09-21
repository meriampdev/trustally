export type BusinessRangeKey = "today" | "cycle" | "week" | "month" | "custom" | "all";

export function resolveBusinessRange(key: BusinessRangeKey, cycleStartedAt?: string | null, customStart?: string, customEnd?: string) {
  const now = new Date();
  const manilaToday = new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: "Asia/Manila" }).format(now);
  const endDate = key === "custom" && customEnd ? customEnd : manilaToday;
  let startDate = endDate;
  if (key === "cycle" && cycleStartedAt) startDate = toManilaDate(cycleStartedAt);
  if (key === "week") startDate = shiftDays(endDate, -6);
  if (key === "month") startDate = `${endDate.slice(0, 7)}-01`;
  if (key === "all") startDate = "2000-01-01";
  if (key === "custom" && customStart) startDate = customStart;
  return { startDate, endDate, startAt: `${startDate}T00:00:00+08:00`, endAt: `${endDate}T23:59:59+08:00` };
}

function shiftDays(value: string, days: number) { const date = new Date(`${value}T12:00:00+08:00`); date.setUTCDate(date.getUTCDate() + days); return toManilaDate(date.toISOString()); }
function toManilaDate(value: string) { return new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: "Asia/Manila" }).format(new Date(value)); }
