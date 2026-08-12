export type CycleStatus = "ACTIVE" | "CHECKING" | "COMPLETED" | "VOIDED";
export type HistoryFilter = "all" | "box_checks" | "stock_added" | "adjustments";
export type LocationRole = "OWNER" | "STAFF";
export type PaymentMethod = "CASH" | "GCASH" | "MAYA" | "BANK" | "OTHER";
export type PaymentTiming = "CURRENT" | "DELAYED" | "ADVANCE" | "UNASSIGNED";
export type PayLaterStatus = "OPEN" | "PARTIALLY_PAID" | "PAID" | "WRITTEN_OFF";
export type CashMovementType = "CASH_REMOVED" | "CASH_RETURNED" | "CASH_CORRECTION";
export type DifferenceResolutionType =
  | "PAY_LATER"
  | "FREE_OWNER_STAFF"
  | "MISSING_PAYMENT"
  | "WRONG_COUNT"
  | "WRONG_MONEY_TOTAL"
  | "OTHER";
export type NonSaleReason =
  | "OWNER_USE"
  | "STAFF_USE"
  | "FREE"
  | "DAMAGED"
  | "EXPIRED"
  | "EVENT_USE"
  | "OTHER";

export interface Product {
  id: string;
  name: string;
  brand?: string | null;
  variant?: string | null;
  displayName: string;
  volume?: string | null;
  unit?: string | null;
  category?: string | null;
  sku?: string | null;
  defaultUnitCost: number;
  currentSellingPrice: number;
  active: boolean;
  lastKnownQuantity?: number | null;
  estimatedRemaining?: number | null;
  updatedAt?: string;
}

export interface HomeRecentResult {
  cycleId: string;
  label: string;
  bottlesTaken: number;
  expectedRevenue: number;
  totalCollected: number;
  immediatePayments: number;
  differenceAmount: number;
  honestyRate: number | null;
  collectionMatchRate: number | null;
  knownPayLater: number;
  accountedAmount: number;
  accountedRate: number | null;
  settledAmount: number;
  settledRate: number | null;
  outstandingAmount: number;
  unaccountedAmount: number;
  honestyLabel: string;
}

export interface BringSuggestion {
  productId: string;
  productName: string;
  averageDailyConsumption: number | null;
  estimatedRemaining: number | null;
  targetQuantity: number | null;
  suggestedBring: number | null;
  status: string;
}

export interface RestockAlert {
  productId: string;
  productName: string;
  estimatedDaysRemaining: number | null;
  suggestedBring: number | null;
}

export interface HomeDashboard {
  hasSetup: boolean;
  locationId?: string | null;
  locationName?: string | null;
  role?: LocationRole | null;
  currentCycle?: {
    id: string;
    cycleNumber: number;
    status: CycleStatus;
    startedAt: string;
    lastCheckedAt: string | null;
    startingBoxStock: number;
    currentAvailableStock: number;
    retailValue: number;
    cashRemoved?: number;
    cashReturned?: number;
    estimatedPhysicalCash?: number | null;
    estimatedRemaining: number | null;
    estimatedRetailValue: number | null;
  } | null;
  recentResult?: HomeRecentResult | null;
  whatToBring: BringSuggestion[];
  alerts: RestockAlert[];
}

export interface SetupProductInput {
  productId?: string;
  name: string;
  brand: string;
  variant: string;
  volume: string;
  unit: string;
  category: string;
  sku: string;
  quantity: string;
  unitCost: string;
  sellingPrice: string;
}

export interface StockAdditionLineInput {
  productId: string;
  quantity: string;
  unitCost: string;
  sellingPrice: string;
}

export interface CheckBoxCountInput {
  productId: string;
  endingQuantity: string;
}

export interface NonSaleRemovalInput {
  id: string;
  productId: string;
  reason: NonSaleReason;
  quantity: string;
  note: string;
}

export interface CheckBoxRefillInput {
  productId: string;
  quantity: string;
  unitCost: string;
  sellingPrice: string;
}

export interface DifferenceResolutionInput {
  type: DifferenceResolutionType | "";
  amount: string;
  customerLabel: string;
  itemsSummary: string;
  dueDate: string;
  note: string;
}

export interface CheckBoxDraft {
  cycleId: string;
  cashCollected: string;
  gcashCollected: string;
  mayaCollected: string;
  counts: Record<string, string>;
  nonSaleRemovals: NonSaleRemovalInput[];
  refillItems: CheckBoxRefillInput[];
  differenceResolution: DifferenceResolutionInput;
  note: string;
}

export interface CheckBoxDraftPayload {
  cycleId: string;
  cycleNumber: number;
  startedAt: string;
  locationName: string;
  items: Array<{
    productId: string;
    productName: string;
    beforeQuantity: number;
    unitCostSnapshot: number;
    sellingPriceSnapshot: number;
  }>;
}

export interface CheckBoxPreview {
  cycleId: string;
  dateLabel: string;
  honestyLabel: string;
  totals: {
    before: number;
    left: number;
    taken: number;
    expectedRevenue: number;
    totalCollected: number;
    differenceAmount: number;
    honestyRate: number | null;
    cashCollected: number;
    gcashCollected: number;
    mayaCollected: number;
    cogs: number;
    grossProfit: number;
    grossMargin: number | null;
    immediatePayments?: number;
    collectionMatchRate?: number | null;
    knownPayLater?: number;
    accountedAmount?: number;
    accountedRate?: number | null;
    settledAmount?: number;
    settledRate?: number | null;
    outstandingAmount?: number;
    unaccountedAmount?: number;
    cashRemoved?: number;
    cashReturned?: number;
    estimatedPhysicalCash?: number | null;
  };
  productBreakdown: Array<{
    productId: string;
    productName: string;
    beforeQuantity: number;
    nonSaleQuantity: number;
    endingQuantity: number;
    unitsTaken: number;
    expectedRevenue: number;
    cogs: number;
    grossProfit: number;
  }>;
}

export interface BoxCheckCompletion {
  completedCycleId: string;
  nextCycleId: string;
  nextCycleStartingStock: number;
  refillTotalUnits: number;
  preview: CheckBoxPreview;
}

export interface HistoryItem {
  id: string;
  eventType: "box_check" | "stock_addition" | "adjustment";
  title: string;
  subtitle: string;
  happenedAt: string;
  cycleId?: string | null;
  bottlesTaken?: number | null;
  expectedRevenue?: number | null;
  totalCollected?: number | null;
  differenceAmount?: number | null;
  honestyRate?: number | null;
  quantity?: number | null;
}

export interface CycleDetail {
  cycleId: string;
  cycleNumber: number;
  status: CycleStatus;
  locationName: string;
  startedAt: string;
  completedAt: string | null;
  durationHours: number | null;
  totals: {
    startingBottles: number;
    stockAddedBottles: number;
    nonSaleBottles: number;
    endingBottles: number;
    bottlesTaken: number;
    expectedRevenue: number;
    totalCollected: number;
    immediatePayments: number;
    differenceAmount: number;
    honestyRate: number | null;
    collectionMatchRate: number | null;
    knownPayLater: number;
    accountedAmount: number;
    accountedRate: number | null;
    settledAmount: number;
    settledRate: number | null;
    outstandingAmount: number;
    unaccountedAmount: number;
    cashCollected: number;
    gcashCollected: number;
    mayaCollected: number;
    cashRemoved: number;
    cashReturned: number;
    estimatedPhysicalCash: number;
    cogs: number;
    grossProfit: number;
    grossMargin: number | null;
  };
  productBreakdown: Array<{
    productId: string;
    productName: string;
    startingQuantity: number;
    stockAddedQuantity: number;
    nonSaleQuantity: number;
    endingQuantity: number;
    unitsTaken: number;
    expectedRevenue: number;
    cogs: number;
    grossProfit: number;
  }>;
  timeline: Array<{
    id: string;
    eventType: string;
    happenedAt: string;
    label: string;
    detail: string;
  }>;
}

export interface ReportsSnapshot {
  rangeKey: string;
  summary: {
    completedCycles: number;
    expectedRevenue: number;
    totalCollected: number;
    paymentsReceived: number;
    differenceAmount: number;
    averageHonestyRate: number | null;
    averageCollectionMatchRate: number | null;
    knownPayLater: number;
    accountedAmount: number;
    accountedRate: number | null;
    settledAmount: number;
    settledRate: number | null;
    outstandingAmount: number;
    unaccountedAmount: number;
    totalShort: number;
    totalOver: number;
    bottlesTaken: number;
    cogs: number;
    grossProfit: number;
    grossMargin: number | null;
    averageCycleDurationHours: number | null;
    averageBottlesPerDay: number | null;
    averageRevenuePerDay: number | null;
    averageRevenuePerCycle: number | null;
  };
  expectedVsCollected: Array<{
    label: string;
    expectedRevenue: number;
    totalCollected: number;
  }>;
  bottlesTaken: Array<{
    label: string;
    bottlesTaken: number;
  }>;
  honestyTrend: Array<{
    label: string;
    honestyRate: number | null;
  }>;
  accountedTrend: Array<{
    label: string;
    accountedRate: number | null;
    settledRate: number | null;
    outstandingAmount: number;
    unaccountedAmount: number;
  }>;
  productPerformance: Array<{
    productId: string;
    productName: string;
    unitsTaken: number;
    expectedRevenue: number;
    cogs: number;
    grossProfit: number;
    grossMargin: number | null;
    averageUnitsPerDay: number | null;
    lastKnownQuantity: number | null;
    estimatedRemaining: number | null;
  }>;
}

export interface Settings {
  currency: string;
  reducedMotion: boolean;
  targetCoverageDays: number;
  checkReminderDays: number;
  lowStockReminders: boolean;
  honestyExcellentMin: number;
  honestyGoodMin: number;
  honestyAttentionMin: number;
}

export interface ProductUpsertInput {
  id?: string | null;
  name: string;
  brand?: string;
  variant?: string;
  volume?: string;
  unit?: string;
  category?: string;
  sku?: string;
  defaultUnitCost: string;
  currentSellingPrice: string;
  active: boolean;
}

export interface PayLaterBalance {
  id: string;
  sourceCycleId: string;
  cycleLabel: string;
  customerLabel?: string | null;
  itemsSummary?: string | null;
  note?: string | null;
  dueDate?: string | null;
  originalAmount: number;
  amountPaid: number;
  remainingAmount: number;
  status: PayLaterStatus;
  createdAt: string;
}

export interface PaymentReceipt {
  id: string;
  amount: number;
  method: PaymentMethod;
  paymentTiming: PaymentTiming;
  receivedAt: string;
  note?: string | null;
  relatedCycleId?: string | null;
  unallocatedAmount: number;
}

export interface CashMovement {
  id: string;
  type: CashMovementType;
  amount: number;
  person?: string | null;
  note?: string | null;
  occurredAt: string;
  createdAt?: string;
}

export interface AccessibleLocation {
  id: string;
  name: string;
  role: LocationRole | null;
  isCurrent: boolean;
}
