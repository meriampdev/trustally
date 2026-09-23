export type CycleStatus = "ACTIVE" | "CHECKING" | "COMPLETED" | "VOIDED";
export type HistoryFilter = "all" | "box_checks" | "stock_added" | "adjustments";
export type LocationRole = "OWNER" | "STAFF";
export type PaymentMethod = "CASH" | "GCASH" | "MAYA" | "BANK" | "OTHER";
export type PaymentTiming = "CURRENT" | "DELAYED" | "ADVANCE" | "UNASSIGNED";
export type DisclosureSource = "unknown" | "self_reported" | "owner_recorded" | "inventory_discrepancy";
export type PaymentExpectation = "unknown" | "required" | "pay_later" | "complimentary";
export type DerivedBottlePaymentStatus =
  | "paid"
  | "partially_paid"
  | "unpaid"
  | "pay_later"
  | "complimentary"
  | "unresolved";
export type PayLaterStatus = "OPEN" | "PARTIALLY_PAID" | "PAID" | "WRITTEN_OFF";
export type CashMovementType = "CASH_REMOVED" | "CASH_RETURNED" | "CASH_CORRECTION";
export type MiscCapitalType = "disabled" | "fixed" | "percentage" | "automatic";
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
  /** @deprecated Payment-derived compatibility alias. Use collectionRate. */
  honestyRate: number | null;
  collectionRate?: number | null;
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
    /** @deprecated Legacy alias for closingChangeFloat. */
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
  /** @deprecated Compatibility value. New UI derives it as cashGenerated. */
  cashCollected: string;
  cashCountedBeforeWithdrawal: string;
  closingChangeFloat: string;
  cashAddedForChange: string;
  cashAddedForChangeNote: string;
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
  openingChangeFloat?: number | null;
  openingChangeFloatSource?: "unknown" | "carried_forward" | "explicit";
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
    /** @deprecated Payment-derived compatibility alias. Use collectionRate. */
    honestyRate: number | null;
    collectionRate?: number | null;
    cashCollected: number;
    openingChangeFloat?: number | null;
    cashCountedBeforeWithdrawal?: number | null;
    cashGenerated?: number | null;
    closingChangeFloat?: number | null;
    cashWithdrawn?: number | null;
    interimOwnerWithdrawals?: number;
    trackedNonSalesCashAdded?: number;
    cashAddedForChangeNote?: string | null;
    gcashCollected: number;
    mayaCollected: number;
    recordedOnlinePayments?: number;
    recordedGcashPayments?: number;
    recordedMayaPayments?: number;
    recordedOtherOnlinePayments?: number;
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
    /** @deprecated Legacy alias for closingChangeFloat. */
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

export interface CompletedCycleCorrectionInput {
  cycleId: string;
  cashCountedBeforeWithdrawal: string;
  closingChangeFloat: string;
  gcashCollected: string;
  mayaCollected: string;
  counts: CheckBoxCountInput[];
  reason: string;
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
  /** @deprecated Payment-derived compatibility alias. Use collectionRate. */
  honestyRate?: number | null;
  collectionRate?: number | null;
  quantity?: number | null;
  cashPayments?: number | null;
  onlinePayments?: number | null;
  cashFloat?: CycleCashFloatDetail | null;
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
    /** @deprecated Payment-derived compatibility alias. Use collectionRate. */
    honestyRate: number | null;
    collectionRate?: number | null;
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
    /** @deprecated Legacy alias for closingChangeFloat. */
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

export interface DetectedCycle {
  cycleId: string;
  cycleNumber: number;
  status: CycleStatus;
  startedAt: string;
  completedAt: string | null;
  timezone: string;
}

export interface RetroactiveUnpaidEntry {
  id: string;
  cycleId: string;
  cycleNumber: number;
  cycleStartedAt: string;
  cycleCompletedAt: string | null;
  takenAt: string;
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  confirmedAmount: number;
  customerLabel: string | null;
  /** Person is a clearer alias; customerLabel remains for older callers. */
  personLabel?: string | null;
  disclosureSource?: DisclosureSource;
  paymentExpectation?: PaymentExpectation;
  classificationRecordedAt?: string | null;
  isUnclassifiedHistorical?: boolean;
  paymentStatus?: DerivedBottlePaymentStatus;
  note: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RetroactiveOnlinePayment {
  id: string;
  cycleId: string;
  cycleNumber: number;
  cycleStartedAt: string;
  cycleCompletedAt: string | null;
  paidAt: string;
  amount: number;
  method: Exclude<PaymentMethod, "CASH">;
  customerLabel: string | null;
  personLabel?: string | null;
  referenceNumber: string | null;
  note: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PersonHonestyHistoryItem {
  id: string;
  type: "bottle" | "payment";
  happenedAt: string;
  quantity?: number;
  amount: number;
  method?: Exclude<PaymentMethod, "CASH">;
  disclosureSource?: DisclosureSource;
  paymentExpectation?: PaymentExpectation;
}

export interface PersonHonestySummary {
  personLabel: string;
  totalKnownBottles: number;
  selfReportedBottles: number;
  ownerRecordedBottles: number;
  inventoryDiscrepancyBottles: number;
  complimentaryBottles: number;
  paymentRequiredBottles: number;
  payLaterBottles: number;
  amountRequired: number;
  payLaterAmount: number;
  amountPaid: number;
  outstandingAmount: number;
  disclosureRate: number | null;
  collectionRate: number | null;
  unclassifiedHistoricalRecords: number;
  recentHistory: PersonHonestyHistoryItem[];
}

export interface CycleHonestyDetail {
  cycleId: string;
  cycleNumber: number;
  status: CycleStatus;
  startedAt: string;
  completedAt: string | null;
  timezone: string;
  summary: {
    totalBottlesTaken: number;
    selfReportedBottles: number;
    ownerRecordedBottles: number;
    inventoryDiscrepancyBottles: number;
    unattributedMissingBottles: number;
    complimentaryBottles: number;
    complimentaryHonestlyDisclosed: number;
    knownAttributedBottles: number;
    disclosureRate: number | null;
    disclosureCoverage: number | null;
    unclassifiedHistoricalRecords: number;
    unclassifiedHistoricalBottles: number;
    paymentRequiredAmount: number;
    payLaterAmount: number;
    complimentaryValue: number;
    unknownPaymentValue: number;
    totalExpectedPayment: number;
    currentlyDueAmount: number;
    expectedRevenue: number;
    physicalCashCollected: number;
    onlinePayments: number;
    totalPayments: number;
    knownUnpaidBottles: number;
    confirmedUnpaidAmount: number;
    outstandingAmount: number;
    outstandingRequiredAmount: number;
    overpaymentAmount: number;
    collectionRate: number | null;
    /** @deprecated Payment-derived compatibility alias. Use collectionRate. */
    honestyRate: number | null;
    coachDeductions: number;
    otherAuthorizedDeductions: number;
    unexplainedOutstandingAmount: number;
    allocationRule: string;
  };
  bottleTakenRecords?: RetroactiveUnpaidEntry[];
  unpaidEntries: RetroactiveUnpaidEntry[];
  onlinePayments: RetroactiveOnlinePayment[];
  personSummaries: PersonHonestySummary[];
}

export interface CyclePaymentRecord {
  id: string;
  cycleId: string;
  cycleLabel: string;
  occurredAt: string;
  recordedAt: string;
  amount: number;
  method: PaymentMethod;
  channel: "cash" | "online";
  source: "cycle_check_total" | "retroactive" | "allocated_receipt" | "direct_receipt";
  personLabel?: string | null;
  referenceNumber?: string | null;
  note?: string | null;
  isItemized: boolean;
}

export interface CyclePaymentDetail {
  cycleId: string;
  cycleNumber: number;
  summary: {
    cashPayments: number;
    onlinePayments: number;
    totalPayments: number;
  };
  records: CyclePaymentRecord[];
}

export interface ChangeFloatAdjustment {
  id: string;
  previousOpeningChangeFloat: number | null;
  newOpeningChangeFloat: number | null;
  previousClosingChangeFloat: number | null;
  newClosingChangeFloat: number | null;
  reason: string;
  createdAt: string;
}

export interface CycleCashFloatDetail {
  cycleId: string;
  cycleNumber: number;
  completedAt?: string | null;
  openingChangeFloat: number | null;
  openingChangeFloatSource: "unknown" | "carried_forward" | "explicit";
  cashCountedBeforeWithdrawal: number | null;
  cashGenerated: number | null;
  closingChangeFloat: number;
  cashWithdrawn: number | null;
  interimOwnerWithdrawals: number;
  trackedNonSalesCashAdded: number;
  cashAddedForChangeNote?: string | null;
  /** @deprecated Legacy alias for closingChangeFloat. */
  cashReturned: number;
  adjustments: ChangeFloatAdjustment[];
}

export interface CycleSetAside {
  cycleId: string;
  cycleNumber: number;
  startedAt: string;
  completedAt: string | null;
  isEstimate: boolean;
  cashCounted: number;
  closingChangeFloat: number;
  cashAvailableAfterChangeFloat: number;
  availableOnlinePayments: number;
  gcashPayments?: number;
  mayaPayments?: number;
  otherOnlinePayments?: number;
  totalAvailable: number;
  puresafeBottlesToReplace: number;
  puresafeCostPerUnit: number | null;
  puresafeCapital: number | null;
  puresafeProductId: string | null;
  missingPuresafeCost: boolean;
  cycleHours: number;
  electricityCostPerHour: number;
  electricityShare: number;
  miscCapitalType: MiscCapitalType;
  fixedMiscCapital: number;
  miscCapitalPercentage: number;
  miscCapital: number | null;
  miscellaneousBottlesToReplace?: number;
  missingMiscellaneousCost?: boolean;
  miscellaneousProductBreakdown?: Array<{
    productId: string;
    productName: string;
    unitsToReplace: number;
    unitCost: number | null;
    capital: number | null;
  }>;
  totalSetAside: number | null;
  remainingEarnings: number | null;
  shortfall: number | null;
  settingsSnapshottedAt: string | null;
  actualSetAside?: {
    id: string;
    puresafeCapital: number;
    otherProductsCapital: number;
    electricityShare: number;
    toStashCash: number;
    onlineToStash: number;
    toStashTotal: number;
    physicalCashTotal: number;
    note: string | null;
    recordedAt: string;
    updatedAt: string;
  } | null;
  otherProductsReserve?: {
    trackingStartedAt: string | null;
    actualSetAside: number | null;
    usedForRestocks: number | null;
    netSetAside: number | null;
    openingBalance: number | null;
    closingBalance: number | null;
  };
}

export interface ReportSetAside {
  summary: {
    cashAvailableAfterChangeFloat: number;
    availableOnlinePayments: number;
    totalAvailable: number;
    puresafeCapital: number | null;
    electricityShare: number;
    miscCapital: number | null;
    totalSetAside: number | null;
    remainingEarnings: number | null;
    shortfall: number | null;
    missingPuresafeCostCycles: number;
    missingMiscellaneousCostCycles?: number;
    actualPuresafeCapital?: number | null;
    actualOtherProductsCapital?: number | null;
    actualElectricityShare?: number | null;
    actualToStashCash?: number | null;
    actualPhysicalTotal?: number | null;
    onlineToStash?: number;
    gcashToStash?: number;
    mayaToStash?: number;
    otherOnlineToStash?: number;
    usedForOtherProductRestocks?: number | null;
    netOtherProductsSetAside?: number | null;
    openingOtherProductsReserve?: number | null;
    closingOtherProductsReserve?: number | null;
    reserveTrackingStartedAt?: string | null;
    actualRecordedCycles?: number;
    actualUnrecordedCycles?: number;
  };
  cycles: CycleSetAside[];
}

export interface ActualSetAsideInput {
  cycleId: string;
  puresafeCapital: string;
  otherProductsCapital: string;
  electricityShare: string;
  toStashCash: string;
  note?: string;
}

export type ExpenseCategory =
  | "Setup"
  | "Equipment"
  | "Repairs"
  | "Supplies"
  | "Transport"
  | "Fees"
  | "Inventory"
  | "Other";

export interface Expense {
  id: string;
  locationId: string;
  incurredOn: string;
  category: ExpenseCategory;
  description: string | null;
  amount: number;
  expenseType?: "OPERATING" | "RESTOCK";
  productId?: string | null;
  restockId?: string | null;
  affectsInventoryCost?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface InventoryRestockInput {
  productId: string;
  quantity: number;
  occurredAt: string;
  totalAmountPaid: string;
  unitCostOverride?: string;
  sellingPrice?: string;
  supplier?: string;
  receiptReference?: string;
  notes?: string;
  puresafeDetail?: Record<string, unknown>;
  idempotencyKey: string;
}

export interface InventoryRestock {
  id: string;
  stockAdditionId: string;
  cycleId: string;
  cycleNumber: number;
  productId: string;
  productName: string;
  productCategory: string;
  occurredAt: string;
  quantity: number;
  previousQuantity: number | null;
  newQuantity: number | null;
  previousAverageCost: number | null;
  unitCost: number;
  totalAmountPaid: number;
  newWeightedAverageCost: number | null;
  supplier: string | null;
  receiptReference: string | null;
  notes: string | null;
  puresafeDetail: Record<string, unknown>;
  costQuality: "VERIFIED" | "ESTIMATED" | "MISSING";
  createdBy: string;
  editable: boolean;
}

export interface PuresafeCostSettings {
  productId: string;
  bottlePackUnits: number;
  bottlePackCost: number;
  defaultPackCount: number;
  waterContainerCost: number;
  defaultBottlesPerContainer: number;
  capSealPerUnit: number;
  stickerPerUnit: number;
  printingPerUnit: number;
  otherPackagingPerUnit: number;
}

export interface BusinessProductPerformance {
  productId: string;
  productName: string;
  category: string;
  currentStock: number;
  weightedAverageUnitCost: number | null;
  inventoryValue: number | null;
  openingCapital: number;
  totalRestockCapital: number;
  capitalInvested: number;
  capitalRecovered: number;
  capitalRemaining: number | null;
  recoveryPercentage: number | null;
  revenue: number;
  grossProfit: number;
  capitalRecoveredAt: string | null;
  cashBreakEvenAt: string | null;
  firstRestockAt: string | null;
  lastRestockAt: string | null;
  dataQuality: "VERIFIED" | "ESTIMATED" | "MISSING";
  periodRestocked: number;
  periodOpeningStock: number;
  periodClosingStock: number;
  periodRestockCapital: number;
  periodUnitsSold: number;
  periodRevenue: number;
  periodCapitalRecovered: number | null;
  periodGrossProfit: number | null;
}

export interface BusinessSaleRecord {
  id: string;
  soldAt: string;
  cycleId: string;
  cycleNumber: number;
  productId: string;
  productName: string;
  productCategory: string;
  quantitySold: number;
  sellingPrice: number;
  revenue: number;
  unitCostUsed: number | null;
  capitalRecovered: number | null;
  grossProfit: number | null;
  grossMargin: number | null;
  paymentMethod: PaymentMethod | null;
  costQuality: "VERIFIED" | "ESTIMATED" | "MISSING";
}

export interface BusinessCycleSummary {
  cycleId: string;
  cycleNumber: number;
  startedAt: string;
  completedAt: string;
  expectedSales: number;
  actualCollections: number;
  cashCollected: number;
  digitalPayments: number;
  changeFloat: number | null;
  closingChangeFloat: number | null;
  difference: number;
  capitalRecovered: number | null;
  grossProfit: number | null;
  otherExpenses: number;
  netProfit: number | null;
}

export interface BusinessStockMovement {
  id: string;
  occurredAt: string;
  productId: string;
  productName: string;
  productCategory: string;
  movementType: "OPENING" | "RESTOCK" | "SALE" | "ADJUSTMENT" | "DAMAGED" | "MISSING" | "COACH_DEDUCTION" | "OTHER";
  quantityIn: number;
  quantityOut: number;
  runningStockBalance: number | null;
  unitCost: number | null;
  inventoryValueChange: number | null;
  reference: string | null;
  notes: string | null;
  dataQuality: "VERIFIED" | "ESTIMATED" | "MISSING";
}

export interface BusinessAccountingReport {
  summary: {
    revenue: number;
    capitalInvested: number;
    capitalRecovered: number | null;
    capitalStillInStock: number | null;
    grossProfit: number | null;
    operatingExpenses: number;
    restockCount: number;
    unitsSold: number;
    inventoryValue: number | null;
    missingCostSales: number;
  };
  products: BusinessProductPerformance[];
  sales: BusinessSaleRecord[];
  restocks: InventoryRestock[];
  expenses: Expense[];
  cycles: BusinessCycleSummary[];
  movements: BusinessStockMovement[];
  trend: Array<{ label: string; revenue: number; grossProfit: number | null; capitalInvested: number; capitalRecovered: number | null }>;
}

export interface ExpenseInput {
  id?: string | null;
  locationId: string;
  incurredOn: string;
  category: ExpenseCategory;
  description?: string | null;
  amount: string;
}

export interface ReportCashFloatDetail {
  summary: {
    cashCounted: number;
    cashGenerated: number;
    cashWithdrawn: number;
    unknownOpeningFloatCycles: number;
  };
  cycles: Array<Omit<CycleCashFloatDetail, "cycleNumber" | "adjustments"> & {
    cycleLabel: string;
    completedAt: string;
  }>;
}

export interface ReportPaymentDetail {
  summary: CyclePaymentDetail["summary"];
  cycles: Array<{
    cycleId: string;
    cycleLabel: string;
    completedAt: string;
    cashPayments: number;
    onlinePayments: number;
    totalPayments: number;
  }>;
  records: CyclePaymentRecord[];
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
    totalKnownBottles: number;
    selfReportedBottles: number;
    ownerRecordedBottles: number;
    inventoryDiscrepancyBottles: number;
    unattributedMissingBottles: number;
    complimentaryBottles: number;
    unclassifiedHistoricalRecords: number;
    knownUnpaidBottles: number;
    knownUnpaidAmount: number;
    disclosureRate: number | null;
    collectionRate: number | null;
    paymentRequiredAmount: number;
    payLaterAmount: number;
    complimentaryValue: number;
    totalPayments: number;
    cashPayments: number;
    onlinePayments: number;
    outstandingRequiredAmount: number;
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
  disclosureCollectionTrend: Array<{
    cycleId: string;
    label: string;
    completedAt: string;
    disclosureRate: number | null;
    collectionRate: number | null;
    selfReportedBottles: number;
    knownAttributedBottles: number;
    knownUnpaidBottles: number;
    outstandingRequiredAmount: number;
  }>;
  knownUnpaidRecords: Array<RetroactiveUnpaidEntry & { cycleLabel: string }>;
  reportCycles: ReportCycleDetail[];
  reportBottleRecords: Array<RetroactiveUnpaidEntry & { cycleLabel: string }>;
  reportOnlinePayments: Array<RetroactiveOnlinePayment & { cycleLabel: string }>;
  reportPayLaterBalances: PayLaterBalance[];
  reportPaymentReceipts: PaymentReceipt[];
  reportPaymentRecords: CyclePaymentRecord[];
  reportCashFloats: ReportCashFloatDetail["cycles"];
  cashFloatSummary: ReportCashFloatDetail["summary"];
}

export interface ReportCycleDetail {
  cycleId: string;
  label: string;
  startedAt: string;
  completedAt: string;
  expectedRevenue: number;
  immediateCollected: number;
  knownPayLater: number;
  accountedAmount: number;
  accountedRate: number | null;
  settledAmount: number;
  settledRate: number | null;
  unaccountedAmount: number;
  differenceAmount: number;
  bottlesTaken: number;
  selfReportedBottles: number;
  ownerRecordedBottles: number;
  inventoryDiscrepancyBottles: number;
  unattributedMissingBottles: number;
  complimentaryBottles: number;
  unclassifiedHistoricalRecords: number;
  disclosureRate: number | null;
  collectionRate: number | null;
  paymentRequiredAmount: number;
  payLaterAmount: number;
  complimentaryValue: number;
  physicalCashCollected: number;
  onlinePayments: number;
  totalPayments: number;
  outstandingRequiredAmount: number;
  overpaymentAmount: number;
}

export interface ReportDrilldown {
  cycles: ReportCycleDetail[];
  bottleRecords: ReportsSnapshot["reportBottleRecords"];
  onlinePayments: ReportsSnapshot["reportOnlinePayments"];
  payLaterBalances: PayLaterBalance[];
  paymentReceipts: PaymentReceipt[];
}

export interface DisclosureCollectionReport {
  rangeKey: string;
  summary: Pick<
    ReportsSnapshot["summary"],
    | "totalKnownBottles"
    | "selfReportedBottles"
    | "ownerRecordedBottles"
    | "inventoryDiscrepancyBottles"
    | "unattributedMissingBottles"
    | "complimentaryBottles"
    | "unclassifiedHistoricalRecords"
    | "knownUnpaidBottles"
    | "knownUnpaidAmount"
    | "disclosureRate"
    | "collectionRate"
    | "paymentRequiredAmount"
    | "payLaterAmount"
    | "complimentaryValue"
    | "totalPayments"
    | "outstandingRequiredAmount"
  >;
  cycleTrend: ReportsSnapshot["disclosureCollectionTrend"];
  knownUnpaidRecords: ReportsSnapshot["knownUnpaidRecords"];
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
  electricityCostPerHour: number;
  miscCapitalType: MiscCapitalType;
  fixedMiscCapital: number;
  miscCapitalPercentage: number;
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
