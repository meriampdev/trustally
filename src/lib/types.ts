export type PaymentMethod = "cash" | "gcash" | "maya" | "other";

export type CashMovementType =
  | "collection"
  | "capital_withdrawal"
  | "cash_float_add"
  | "cash_float_remove"
  | "expense"
  | "adjustment";

export type InventoryAdjustmentType =
  | "damaged"
  | "expired"
  | "free"
  | "owner_use"
  | "staff_use"
  | "event_use"
  | "missing"
  | "count_correction"
  | "other";

export type ReconciliationStatus = "open" | "reconciled" | "flagged";

export type ActivityKind =
  | "payment"
  | "restock"
  | "cash_movement"
  | "inventory_count"
  | "adjustment"
  | "reconciliation";

export type HonestyBand = "excellent" | "good" | "warning" | "critical";

export interface Product {
  id: string;
  name: string;
  brand: string;
  variant: string;
  volume: number | null;
  unit: string;
  sku: string;
  category: string;
  defaultCost: number;
  sellingPrice: number;
  active: boolean;
}

export interface InventorySnapshotItem {
  productId: string;
  productName: string;
  category: string;
  bookQuantity: number;
  capitalValue: number;
  retailValue: number;
  averageUnitCost: number;
  sellingPrice: number;
}

export interface DashboardSummary {
  currentInventoryUnits: number;
  inventoryValue: number;
  expectedSalesValue: number;
  salesThisMonth: number;
  grossProfitThisMonth: number;
  collectionRate: number;
  shortageThisMonth: number;
  expectedThisMonth: number;
  collectedThisMonth: number;
  currentCashInBox: number;
}

export interface ActivityItem {
  id: string;
  kind: ActivityKind;
  title: string;
  subtitle: string;
  amount: number | null;
  secondaryAmount: number | null;
  date: string;
  createdAt: string;
  notes?: string;
}

export interface ActivityPage {
  items: ActivityItem[];
  totalCount: number;
  hasMore: boolean;
}

export interface ReconciliationLineItem {
  id: string;
  productId: string;
  productName: string;
  openingQuantity: number;
  restockedQuantity: number;
  adjustmentQuantity: number;
  closingQuantity: number;
  unitsSold: number;
  expectedRevenue: number;
  capitalUsed: number;
}

export interface ReconciliationSummary {
  id: string;
  startDate: string;
  endDate: string;
  openingInventory: number;
  restockedInventory: number;
  closingInventory: number;
  unitsSold: number;
  expectedRevenue: number;
  paymentsReceived: number;
  shortageOrOverage: number;
  collectionRate: number;
  capitalOfSoldGoods: number;
  grossProfit: number;
  status: ReconciliationStatus;
  notes?: string;
  items: ReconciliationLineItem[];
  paymentBreakdown: PaymentMethodBreakdown[];
}

export interface PaymentMethodBreakdown {
  method: PaymentMethod;
  amount: number;
  share: number;
}

export interface ReportMonth {
  label: string;
  expectedRevenue: number;
  paymentsReceived: number;
  shortageOrOverage: number;
  grossProfit: number;
  collectionRate: number;
  unitsSold: number;
}

export interface ProductPerformance {
  productId: string;
  productName: string;
  unitsSold: number;
  revenue: number;
  capital: number;
  grossProfit: number;
  margin: number;
  averageDailySales: number;
  currentStock: number;
  daysOfStockRemaining: number | null;
}

export interface Settings {
  reducedMotion: boolean;
  currency: "PHP";
  defaultPaymentMethod: PaymentMethod;
  honestyExcellentThreshold: number;
  honestyGoodThreshold: number;
  honestyWarningThreshold: number;
}

export interface ActivityFilters {
  search?: string;
  kind?: ActivityKind | "all";
  offset: number;
  limit: number;
}

export interface PaymentInput {
  amount: number;
  method: PaymentMethod;
  date: string;
  notes?: string;
}

export interface RestockLineInput {
  productId: string;
  quantity: number;
  unitCost: number;
  sellingPrice: number;
  supplier?: string;
}

export interface RestockInput {
  date: string;
  notes?: string;
  items: RestockLineInput[];
}

export interface CashMovementInput {
  type: CashMovementType;
  amount: number;
  date: string;
  notes?: string;
}

export interface InventoryAdjustmentInput {
  productId: string;
  quantityDelta: number;
  adjustmentType: InventoryAdjustmentType;
  date: string;
  reason?: string;
}

export interface InventoryCountInput {
  date: string;
  notes?: string;
  items: Array<{
    productId: string;
    expectedQuantity: number;
    actualQuantity: number;
  }>;
}
