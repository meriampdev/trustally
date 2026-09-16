export type ReportRangeKey = "7d" | "30d" | "month" | "3m" | "6m" | "1y" | "custom";

export const reportRangeOptions: Array<{ value: ReportRangeKey; label: string }> = [
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
  { value: "month", label: "This month" },
  { value: "3m", label: "3 months" },
  { value: "6m", label: "6 months" },
  { value: "1y", label: "1 year" },
  { value: "custom", label: "Custom dates" },
];

const dateInputFormatter = new Intl.DateTimeFormat("en-CA", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  timeZone: "Asia/Manila",
});

const dateLabelFormatter = new Intl.DateTimeFormat("en-PH", {
  year: "numeric",
  month: "short",
  day: "numeric",
  timeZone: "Asia/Manila",
});

export function getDefaultReportDateRange() {
  const endDate = dateInputFormatter.format(new Date());
  const start = new Date(`${endDate}T12:00:00+08:00`);
  start.setUTCDate(start.getUTCDate() - 29);

  return {
    startDate: dateInputFormatter.format(start),
    endDate,
  };
}

export function formatReportDateRange(startDate: string, endDate: string) {
  if (!startDate || !endDate) return "Custom dates";
  const start = dateLabelFormatter.format(new Date(`${startDate}T12:00:00+08:00`));
  const end = dateLabelFormatter.format(new Date(`${endDate}T12:00:00+08:00`));
  return `${start} – ${end}`;
}
