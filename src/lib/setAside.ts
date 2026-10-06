import type { CyclePaymentRecord, CycleSetAside, ReportSetAside } from "./types";

interface SetAsideFunds {
  cashAvailableAfterChangeFloat: number;
  availableOnlinePayments: number;
  eligibleOnlineReservePayments?: number;
  mayaPayments?: number;
  unionbankPayments?: number;
  bpiPayments?: number;
  legacyBankPayments?: number;
  totalSetAside: number | null;
}

interface SetAsideShareSource extends SetAsideFunds {
  puresafeCapital: number | null;
  electricityShare: number;
  miscCapital: number | null;
  contingencyCapital?: number;
}

export function summarizeOnlinePayments(records: CyclePaymentRecord[]) {
  return records.reduce(
    (summary, record) => {
      if (record.channel !== "online") return summary;
      if (record.method === "GCASH") summary.gcashPayments += record.amount;
      else if (record.method === "MAYA") summary.mayaPayments += record.amount;
      else if (record.method === "UNIONBANK") summary.unionbankPayments += record.amount;
      else if (record.method === "BPI") summary.bpiPayments += record.amount;
      else if (record.method === "BANK") summary.legacyBankPayments += record.amount;
      else summary.otherOnlinePayments += record.amount;
      summary.onlinePayments += record.amount;
      return summary;
    },
    { gcashPayments: 0, mayaPayments: 0, unionbankPayments: 0, bpiPayments: 0, legacyBankPayments: 0, otherOnlinePayments: 0, onlinePayments: 0 },
  );
}

export interface SetAsideShareComparison {
  puresafe: { target: number | null; canSetAside: number | null };
  electricity: { target: number; canSetAside: number | null };
  otherProducts: { target: number | null; canSetAside: number | null };
  contingency: { target: number; canSetAside: number | null };
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
  eligibleOnlineReservePayments = 0,
  totalSetAside,
}: SetAsideFunds) {
  if (totalSetAside == null) {
    return {
      cashAfterSetAside: null,
      eligibleOnlineUsed: null,
      remainingEarnings: null,
      shortfall: null,
    };
  }

  const eligibleOnlineUsed = Math.min(eligibleOnlineReservePayments, Math.max(totalSetAside - cashAvailableAfterChangeFloat, 0));
  const cashAfterSetAside = Math.max(cashAvailableAfterChangeFloat - totalSetAside, 0);
  return {
    cashAfterSetAside,
    eligibleOnlineUsed,
    remainingEarnings: Math.max(availableOnlinePayments - eligibleOnlineUsed, 0) + cashAfterSetAside,
    shortfall: Math.max(totalSetAside - cashAvailableAfterChangeFloat - eligibleOnlineReservePayments, 0),
  };
}

export function calculateSetAsideShareComparison(value: SetAsideShareSource): SetAsideShareComparison {
  const eligibleOnlineReservePayments = value.eligibleOnlineReservePayments ?? (
    (value.mayaPayments ?? 0)
    + (value.unionbankPayments ?? 0)
    + (value.bpiPayments ?? 0)
    + (value.legacyBankPayments ?? 0)
  );
  let remainingFunding = Math.max(value.cashAvailableAfterChangeFloat, 0) + Math.max(eligibleOnlineReservePayments, 0);

  const puresafeCanSetAside = value.puresafeCapital == null
    ? null
    : Math.min(remainingFunding, value.puresafeCapital);
  if (puresafeCanSetAside != null) remainingFunding -= puresafeCanSetAside;

  const otherProductsCanSetAside = puresafeCanSetAside == null || value.miscCapital == null
    ? null
    : Math.min(remainingFunding, value.miscCapital);
  if (otherProductsCanSetAside != null) remainingFunding -= otherProductsCanSetAside;

  const electricityCanSetAside = otherProductsCanSetAside == null
    ? null
    : Math.min(remainingFunding, value.electricityShare);
  if (electricityCanSetAside != null) remainingFunding -= electricityCanSetAside;

  const contingencyTarget = value.contingencyCapital ?? 0;
  const contingencyCanSetAside = electricityCanSetAside == null
    ? null
    : Math.min(remainingFunding, contingencyTarget);
  if (contingencyCanSetAside != null) remainingFunding -= contingencyCanSetAside;

  const totalReserveTarget = value.puresafeCapital == null || value.miscCapital == null
    ? null
    : value.puresafeCapital + value.electricityShare + value.miscCapital + contingencyTarget;
  const result = calculateCashOnlySetAside({ ...value, eligibleOnlineReservePayments, totalSetAside: totalReserveTarget });
  const targetToStash = result.remainingEarnings;
  const cashAfterReserves = contingencyCanSetAside == null ? null : result.cashAfterSetAside;

  return {
    puresafe: { target: value.puresafeCapital, canSetAside: puresafeCanSetAside },
    electricity: { target: value.electricityShare, canSetAside: electricityCanSetAside },
    otherProducts: { target: value.miscCapital, canSetAside: otherProductsCanSetAside },
    contingency: { target: contingencyTarget, canSetAside: contingencyCanSetAside },
    toStash: {
      target: targetToStash,
      canSetAside: cashAfterReserves == null ? null : value.availableOnlinePayments + cashAfterReserves,
      onlinePayments: Math.max(value.availableOnlinePayments - (result.eligibleOnlineUsed ?? 0), 0),
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
    contingency: {
      target: comparisons.reduce((sum, item) => sum + item.contingency.target, 0),
      canSetAside: sumNullable(comparisons.map((item) => item.contingency.canSetAside)),
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
  // Once Actual is recorded, the server returns the target and shortfall
  // snapshots stored with that cycle. Preserve them even if later corrections
  // change another derived cash field.
  if (value.actualSetAside) return value;
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
