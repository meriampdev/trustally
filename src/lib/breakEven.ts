import type { Expense, ReportSetAside, ReportsSnapshot } from "./types";

export interface BreakEvenResult {
  totalExpenses: number;
  netOperatingProfit: number | null;
  balance: number | null;
  remainingToBreakEven: number | null;
  progress: number | null;
  averageDailyOperatingProfit: number | null;
  projectedBreakEvenDate: string | null;
  reachedBreakEvenDate: string | null;
  categoryTotals: Array<{ category: string; amount: number }>;
}

export function calculateBreakEven(
  expenses: Expense[],
  snapshot: ReportsSnapshot,
  setAside: ReportSetAside,
  asOfDate: string,
): BreakEvenResult {
  const operatingExpenses = expenses.filter((expense) => !expense.affectsInventoryCost);
  const totalExpenses = operatingExpenses.reduce((sum, expense) => sum + expense.amount, 0);
  const netOperatingProfit = setAside.summary.totalSetAside == null
    ? null
    : snapshot.summary.totalPayments - setAside.summary.totalSetAside;
  const balance = netOperatingProfit == null ? null : netOperatingProfit - totalExpenses;
  const remainingToBreakEven = balance == null ? null : Math.max(-balance, 0);
  const progress = netOperatingProfit == null || totalExpenses <= 0
    ? null
    : Math.min(Math.max(netOperatingProfit, 0) / totalExpenses * 100, 100);

  const categoryMap = new Map<string, number>();
  operatingExpenses.forEach((expense) => {
    categoryMap.set(expense.category, (categoryMap.get(expense.category) ?? 0) + expense.amount);
  });
  const categoryTotals = [...categoryMap.entries()]
    .map(([category, amount]) => ({ category, amount }))
    .sort((left, right) => right.amount - left.amount);

  const earliestTimestamp = Math.min(
    ...operatingExpenses.map((expense) => new Date(`${expense.incurredOn}T00:00:00+08:00`).getTime()),
    ...snapshot.reportCycles.map((cycle) => new Date(cycle.startedAt).getTime()),
  );
  const asOfTimestamp = new Date(`${asOfDate}T23:59:59+08:00`).getTime();
  const elapsedDays = Number.isFinite(earliestTimestamp)
    ? Math.max(Math.ceil((asOfTimestamp - earliestTimestamp) / 86_400_000), 1)
    : 1;
  const averageDailyOperatingProfit = netOperatingProfit != null && netOperatingProfit > 0
    ? netOperatingProfit / elapsedDays
    : null;
  const projectedBreakEvenDate = remainingToBreakEven != null
    && remainingToBreakEven > 0
    && averageDailyOperatingProfit != null
    ? addDays(asOfDate, Math.ceil(remainingToBreakEven / averageDailyOperatingProfit))
    : null;

  const setAsideByCycle = new Map(setAside.cycles.map((cycle) => [cycle.cycleId, cycle]));
  const events = [
    ...operatingExpenses.map((expense) => ({
      at: new Date(`${expense.incurredOn}T00:00:00+08:00`).getTime(),
      date: expense.incurredOn,
      expense: expense.amount,
      profit: 0,
      order: 0,
    })),
    ...snapshot.reportCycles.map((cycle) => {
      const cycleSetAside = setAsideByCycle.get(cycle.cycleId);
      return {
        at: new Date(cycle.completedAt).getTime(),
        date: toManilaDate(cycle.completedAt),
        expense: 0,
        profit: cycleSetAside?.totalSetAside == null
          ? 0
          : cycle.totalPayments - cycleSetAside.totalSetAside,
        order: 1,
      };
    }),
  ].sort((left, right) => left.at - right.at || left.order - right.order);
  let cumulativeExpenses = 0;
  let cumulativeProfit = 0;
  let reachedBreakEvenDate: string | null = null;
  if (balance != null && balance >= 0 && totalExpenses > 0) {
    for (const event of events) {
      cumulativeExpenses += event.expense;
      cumulativeProfit += event.profit;
      if (cumulativeExpenses > 0 && cumulativeProfit >= cumulativeExpenses) {
        reachedBreakEvenDate = event.date;
        break;
      }
    }
  }

  return {
    totalExpenses,
    netOperatingProfit,
    balance,
    remainingToBreakEven,
    progress,
    averageDailyOperatingProfit,
    projectedBreakEvenDate,
    reachedBreakEvenDate,
    categoryTotals,
  };
}

function addDays(value: string, days: number) {
  const date = new Date(`${value}T12:00:00+08:00`);
  date.setUTCDate(date.getUTCDate() + days);
  return toManilaDate(date.toISOString());
}

function toManilaDate(value: string) {
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Asia/Manila",
  }).format(new Date(value));
}
