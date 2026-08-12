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
