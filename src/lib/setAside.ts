import type { CycleSetAside, ReportSetAside } from "./types";

interface SetAsideFunds {
  cashAvailableAfterChangeFloat: number;
  availableOnlinePayments: number;
  totalSetAside: number | null;
}

export function calculateCashOnlySetAside({
  cashAvailableAfterChangeFloat,
  availableOnlinePayments,
  totalSetAside,
}: SetAsideFunds) {
  if (totalSetAside == null) {
    return { cashAfterSetAside: null, remainingEarnings: null, shortfall: null };
  }

  const cashAfterSetAside = Math.max(cashAvailableAfterChangeFloat - totalSetAside, 0);
  return {
    cashAfterSetAside,
    remainingEarnings: availableOnlinePayments + cashAfterSetAside,
    shortfall: Math.max(totalSetAside - cashAvailableAfterChangeFloat, 0),
  };
}

export function applyCashOnlyCycleSetAside(value: CycleSetAside): CycleSetAside {
  const result = calculateCashOnlySetAside(value);
  return {
    ...value,
    remainingEarnings: result.remainingEarnings,
    shortfall: result.shortfall,
  };
}

export function applyCashOnlyReportSetAside(value: ReportSetAside): ReportSetAside {
  const cycles = value.cycles.map(applyCashOnlyCycleSetAside);
  const allCyclesCalculated = cycles.every((cycle) => cycle.totalSetAside != null);
  const summaryResult = calculateCashOnlySetAside(value.summary);

  return {
    ...value,
    summary: {
      ...value.summary,
      remainingEarnings: cycles.length && allCyclesCalculated
        ? cycles.reduce((sum, cycle) => sum + (cycle.remainingEarnings ?? 0), 0)
        : summaryResult.remainingEarnings,
      shortfall: cycles.length && allCyclesCalculated
        ? cycles.reduce((sum, cycle) => sum + (cycle.shortfall ?? 0), 0)
        : summaryResult.shortfall,
    },
    cycles,
  };
}
