import type { CycleSetAside, ReportSetAside } from "./types";

interface SetAsideFunds {
  cashAvailableAfterChangeFloat: number;
  availableOnlinePayments: number;
  totalSetAside: number | null;
}

interface SetAsideShareSource extends SetAsideFunds {
  puresafeCapital: number | null;
  electricityShare: number;
  miscCapital: number | null;
}

export interface SetAsideShareComparison {
  puresafe: { target: number | null; canSetAside: number | null };
  electricity: { target: number; canSetAside: number | null };
  otherProducts: { target: number | null; canSetAside: number | null };
  toStash: {
    target: number | null;
    canSetAside: number | null;
    onlinePayments: number;
    cashAfterReserves: number | null;
  };
}

export function calculateCashOnlySetAside({
  cashAvailableAfterChangeFloat,
  availableOnlinePayments,
  totalSetAside,
}: SetAsideFunds) {
  if (totalSetAside == null) {
    return {
      cashAfterSetAside: null,
      remainingEarnings: null,
      shortfall: null,
    };
  }

  const cashAfterSetAside = Math.max(cashAvailableAfterChangeFloat - totalSetAside, 0);
  return {
    cashAfterSetAside,
    remainingEarnings: availableOnlinePayments + cashAfterSetAside,
    shortfall: Math.max(totalSetAside - cashAvailableAfterChangeFloat, 0),
  };
}

export function calculateSetAsideShareComparison(value: SetAsideShareSource): SetAsideShareComparison {
  let remainingCash = Math.max(value.cashAvailableAfterChangeFloat, 0);

  const puresafeCanSetAside = value.puresafeCapital == null
    ? null
    : Math.min(remainingCash, value.puresafeCapital);
  if (puresafeCanSetAside != null) remainingCash -= puresafeCanSetAside;

  const otherProductsCanSetAside = puresafeCanSetAside == null || value.miscCapital == null
    ? null
    : Math.min(remainingCash, value.miscCapital);
  if (otherProductsCanSetAside != null) remainingCash -= otherProductsCanSetAside;

  const electricityCanSetAside = otherProductsCanSetAside == null
    ? null
    : Math.min(remainingCash, value.electricityShare);
  if (electricityCanSetAside != null) remainingCash -= electricityCanSetAside;

  const totalReserveTarget = value.puresafeCapital == null || value.miscCapital == null
    ? null
    : value.puresafeCapital + value.electricityShare + value.miscCapital;
  const targetToStash = totalReserveTarget != null
    ? Math.max(
        value.cashAvailableAfterChangeFloat
          + value.availableOnlinePayments
          - totalReserveTarget,
        0,
      )
    : null;
  const cashAfterReserves = electricityCanSetAside == null ? null : remainingCash;

  return {
    puresafe: { target: value.puresafeCapital, canSetAside: puresafeCanSetAside },
    electricity: { target: value.electricityShare, canSetAside: electricityCanSetAside },
    otherProducts: { target: value.miscCapital, canSetAside: otherProductsCanSetAside },
    toStash: {
      target: targetToStash,
      canSetAside: cashAfterReserves == null ? null : value.availableOnlinePayments + cashAfterReserves,
      onlinePayments: value.availableOnlinePayments,
      cashAfterReserves,
    },
  };
}

export function calculateReportSetAsideShareComparison(value: ReportSetAside): SetAsideShareComparison {
  const comparisons = value.cycles.length
    ? value.cycles.map(calculateSetAsideShareComparison)
    : [calculateSetAsideShareComparison(value.summary)];
  const sumNullable = (values: Array<number | null>) =>
    values.every((item) => item != null)
      ? values.reduce<number>((sum, item) => sum + (item ?? 0), 0)
      : null;

  return {
    puresafe: {
      target: sumNullable(comparisons.map((item) => item.puresafe.target)),
      canSetAside: sumNullable(comparisons.map((item) => item.puresafe.canSetAside)),
    },
    electricity: {
      target: comparisons.reduce((sum, item) => sum + item.electricity.target, 0),
      canSetAside: sumNullable(comparisons.map((item) => item.electricity.canSetAside)),
    },
    otherProducts: {
      target: sumNullable(comparisons.map((item) => item.otherProducts.target)),
      canSetAside: sumNullable(comparisons.map((item) => item.otherProducts.canSetAside)),
    },
    toStash: {
      target: sumNullable(comparisons.map((item) => item.toStash.target)),
      canSetAside: sumNullable(comparisons.map((item) => item.toStash.canSetAside)),
      onlinePayments: comparisons.reduce((sum, item) => sum + item.toStash.onlinePayments, 0),
      cashAfterReserves: sumNullable(comparisons.map((item) => item.toStash.cashAfterReserves)),
    },
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
