const peso = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  maximumFractionDigits: 2,
});

const shortDate = new Intl.DateTimeFormat("en-PH", {
  month: "short",
  day: "numeric",
});

const shortDateTime = new Intl.DateTimeFormat("en-PH", {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

const manilaDateTime = new Intl.DateTimeFormat("en-PH", {
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "Asia/Manila",
});

export function formatCurrency(value: number | null | undefined) {
  return peso.format(value ?? 0);
}

export function formatCount(value: number | null | undefined, noun = "bottles") {
  const resolved = value ?? 0;
  return `${resolved.toLocaleString()} ${noun}`;
}

export function formatDateLabel(value: string | null | undefined) {
  if (!value) {
    return "Not yet";
  }

  return shortDate.format(new Date(value));
}

export function formatDateTimeLabel(value: string | null | undefined) {
  if (!value) {
    return "Not yet";
  }

  return shortDateTime.format(new Date(value));
}

export function formatManilaDateTime(value: string | null | undefined) {
  if (!value) {
    return "Not yet";
  }

  return manilaDateTime.format(new Date(value));
}

export function toManilaDateTimeInput(value: string | Date = new Date()) {
  const date = typeof value === "string" ? new Date(value) : value;
  const parts = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: "Asia/Manila",
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value ?? "";

  return `${part("year")}-${part("month")}-${part("day")}T${part("hour")}:${part("minute")}`;
}

export function manilaDateTimeInputToIso(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) {
    throw new Error("Enter a valid date and time.");
  }

  return new Date(`${value}:00+08:00`).toISOString();
}

export function formatDateRange(startedAt: string, completedAt?: string | null) {
  const start = shortDate.format(new Date(startedAt));

  if (!completedAt) {
    return `${start} -> now`;
  }

  return `${start} -> ${shortDate.format(new Date(completedAt))}`;
}

export function formatPercent(value: number | null | undefined) {
  if (value == null) {
    return "Not enough data";
  }

  return `${value.toFixed(1)}%`;
}

export function formatDurationFromNow(value: string | null | undefined) {
  if (!value) {
    return "Not started";
  }

  const startedAt = new Date(value).getTime();
  const diffMs = Math.max(Date.now() - startedAt, 0);
  const totalHours = Math.floor(diffMs / 3_600_000);
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;

  if (days <= 0) {
    return `${hours} hour${hours === 1 ? "" : "s"}`;
  }

  return `${days} day${days === 1 ? "" : "s"} ${hours} hour${hours === 1 ? "" : "s"}`;
}

export function parseNumberInput(value: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    return 0;
  }

  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : 0;
}
