import { PostgrestError, RealtimeChannel } from "@supabase/supabase-js";
import { formatMonthLabel } from "./format";
import {
  ActivityFilters,
  ActivityItem,
  ActivityPage,
  CashMovementInput,
  DashboardSummary,
  InventoryAdjustmentInput,
  InventoryCountInput,
  InventorySnapshotItem,
  PaymentInput,
  PaymentMethodBreakdown,
  Product,
  ProductPerformance,
  ReconciliationSummary,
  ReportMonth,
  RestockInput,
  Settings,
} from "./types";
import { supabase } from "../utils/supabase";

const defaultSettings: Settings = {
  reducedMotion: false,
  currency: "PHP",
  defaultPaymentMethod: "cash",
  honestyExcellentThreshold: 98,
  honestyGoodThreshold: 95,
  honestyWarningThreshold: 90,
};

interface DashboardSummaryRow {
  current_inventory_units: number | string | null;
  inventory_value: number | string | null;
  expected_sales_value: number | string | null;
  sales_this_month: number | string | null;
  gross_profit_this_month: number | string | null;
  collection_rate: number | string | null;
  shortage_this_month: number | string | null;
  expected_this_month: number | string | null;
  collected_this_month: number | string | null;
  current_cash_in_box: number | string | null;
}

interface ActivityFeedRow {
  id: string;
  kind: ActivityItem["kind"];
  title: string;
  subtitle: string;
  amount: number | string | null;
  secondary_amount: number | string | null;
  activity_date: string;
  created_at: string;
  notes: string | null;
  total_count: number;
}

interface ReportMonthRow {
  month_start: string;
  expected_revenue: number | string;
  payments_received: number | string;
  shortage_or_overage: number | string;
  gross_profit: number | string;
  collection_rate: number | string;
  units_sold: number | string;
}

interface ProductPerformanceRow {
  product_id: string;
  product_name: string;
  units_sold: number | string;
  revenue: number | string;
  capital: number | string;
  gross_profit: number | string;
  margin: number | string;
  average_daily_sales: number | string;
  current_stock: number | string;
  days_of_stock_remaining: number | string | null;
}

interface PaymentMethodBreakdownRow {
  payment_method: string;
  amount: number | string;
  share: number | string;
}

interface InventorySnapshotRow {
  product_id: string;
  product_name: string;
  category: string;
  book_quantity: number | string;
  capital_value: number | string;
  retail_value: number | string;
  average_unit_cost: number | string;
  selling_price: number | string;
}

interface ProductRow {
  id: string;
  name: string;
  brand: string | null;
  variant: string | null;
  volume: number | string | null;
  unit: string | null;
  sku: string | null;
  category: string;
  default_cost: number | string;
  selling_price: number | string;
  active: boolean;
}

interface SettingsRow {
  reduced_motion: boolean;
  currency: "PHP";
  default_payment_method: Settings["defaultPaymentMethod"];
  honesty_excellent_threshold: number | string;
  honesty_good_threshold: number | string;
  honesty_warning_threshold: number | string;
}

interface ReconciliationRow {
  id: string;
  start_date: string;
  end_date: string;
  opening_inventory: number | string;
  restocked_inventory: number | string;
  closing_inventory: number | string;
  units_sold: number | string;
  expected_revenue: number | string;
  payments_received: number | string;
  shortage_or_overage: number | string;
  collection_rate: number | string;
  capital_of_sold_goods: number | string;
  gross_profit: number | string;
  notes: string | null;
  status: ReconciliationSummary["status"];
}

interface ReconciliationItemRow {
  id: string;
  product_id: string;
  opening_quantity: number | string;
  restocked_quantity: number | string;
  adjustment_quantity: number | string;
  closing_quantity: number | string;
  units_sold: number | string;
  expected_revenue: number | string;
  capital_used: number | string;
  products:
    | {
        name: string;
      }
    | {
        name: string;
      }[]
    | null;
}

export class AuthRequiredError extends Error {
  constructor(message = "Sign in to manage the honesty box.") {
    super(message);
    this.name = "AuthRequiredError";
  }
}

export async function fetchDashboardSummary() {
  await requireUserId();
  const { data, error } = await supabase.rpc("get_dashboard_summary");

  if (error) {
    throw error;
  }

  const row = ((Array.isArray(data) ? data[0] : data) ?? null) as DashboardSummaryRow | null;

  return {
    currentInventoryUnits: toNumber(row?.current_inventory_units),
    inventoryValue: toNumber(row?.inventory_value),
    expectedSalesValue: toNumber(row?.expected_sales_value),
    salesThisMonth: toNumber(row?.sales_this_month),
    grossProfitThisMonth: toNumber(row?.gross_profit_this_month),
    collectionRate: toNumber(row?.collection_rate),
    shortageThisMonth: toNumber(row?.shortage_this_month),
    expectedThisMonth: toNumber(row?.expected_this_month),
    collectedThisMonth: toNumber(row?.collected_this_month),
    currentCashInBox: toNumber(row?.current_cash_in_box),
  } satisfies DashboardSummary;
}

export async function fetchActivityPage(filters: ActivityFilters): Promise<ActivityPage> {
  await requireUserId();
  const { data, error } = await supabase.rpc("get_activity_feed", {
    p_limit: filters.limit,
    p_offset: filters.offset,
    p_search: filters.search?.trim() || null,
    p_kind: !filters.kind || filters.kind === "all" ? null : filters.kind,
  });

  if (error) {
    throw error;
  }

  const rows = ((data ?? []) as ActivityFeedRow[]).map(mapActivityItem);
  const totalCount = ((data?.[0] as ActivityFeedRow | undefined)?.total_count ?? 0);

  return {
    items: rows,
    totalCount,
    hasMore: filters.offset + rows.length < totalCount,
  };
}

export async function fetchRecentActivity(limit = 6) {
  const page = await fetchActivityPage({
    offset: 0,
    limit,
  });

  return page.items;
}

export async function fetchTodayCollectedTotal() {
  await requireUserId();
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from("payments")
    .select("amount")
    .eq("payment_date", today);

  if (error) {
    throw error;
  }

  return ((data ?? []) as Array<{ amount: number | string }>).reduce(
    (sum, row) => sum + toNumber(row.amount),
    0,
  );
}

export async function fetchReportMonths() {
  await requireUserId();
  const { data, error } = await supabase.rpc("get_business_report_months");

  if (error) {
    throw error;
  }

  return ((data ?? []) as ReportMonthRow[]).map((row) => ({
    label: formatMonthLabel(new Date(`${row.month_start}T00:00:00`)),
    expectedRevenue: toNumber(row.expected_revenue),
    paymentsReceived: toNumber(row.payments_received),
    shortageOrOverage: toNumber(row.shortage_or_overage),
    grossProfit: toNumber(row.gross_profit),
    collectionRate: toNumber(row.collection_rate),
    unitsSold: toNumber(row.units_sold),
  })) satisfies ReportMonth[];
}

export async function fetchProductPerformance() {
  await requireUserId();
  const { data, error } = await supabase.rpc("get_product_performance");

  if (error) {
    throw error;
  }

  return ((data ?? []) as ProductPerformanceRow[]).map((row) => ({
    productId: row.product_id,
    productName: row.product_name,
    unitsSold: toNumber(row.units_sold),
    revenue: toNumber(row.revenue),
    capital: toNumber(row.capital),
    grossProfit: toNumber(row.gross_profit),
    margin: toNumber(row.margin),
    averageDailySales: toNumber(row.average_daily_sales),
    currentStock: toNumber(row.current_stock),
    daysOfStockRemaining:
      row.days_of_stock_remaining === null
        ? null
        : toNumber(row.days_of_stock_remaining),
  })) satisfies ProductPerformance[];
}

export async function fetchPaymentMethodDistribution() {
  await requireUserId();
  const { data, error } = await supabase.rpc("get_payment_method_distribution");

  if (error) {
    throw error;
  }

  return ((data ?? []) as PaymentMethodBreakdownRow[]).map((row) => ({
    method: row.payment_method as PaymentMethodBreakdown["method"],
    amount: toNumber(row.amount),
    share: toNumber(row.share),
  })) satisfies PaymentMethodBreakdown[];
}

export async function fetchInventorySnapshot() {
  await requireUserId();
  const { data, error } = await supabase.rpc("get_inventory_snapshot");

  if (error) {
    throw error;
  }

  return ((data ?? []) as InventorySnapshotRow[]).map((row) => ({
    productId: row.product_id,
    productName: row.product_name,
    category: row.category,
    bookQuantity: toNumber(row.book_quantity),
    capitalValue: toNumber(row.capital_value),
    retailValue: toNumber(row.retail_value),
    averageUnitCost: toNumber(row.average_unit_cost),
    sellingPrice: toNumber(row.selling_price),
  })) satisfies InventorySnapshotItem[];
}

export async function fetchProducts() {
  await requireUserId();
  const { data, error } = await supabase
    .from("products")
    .select(
      "id, name, brand, variant, volume, unit, sku, category, default_cost, selling_price, active",
    )
    .eq("active", true)
    .order("name", { ascending: true });

  if (error) {
    throw error;
  }

  return ((data ?? []) as ProductRow[]).map(mapProduct) satisfies Product[];
}

export async function fetchSettings() {
  const userId = await requireUserId();
  const { data, error } = await supabase
    .from("user_settings")
    .select(
      "reduced_motion, currency, default_payment_method, honesty_excellent_threshold, honesty_good_threshold, honesty_warning_threshold",
    )
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    return saveSettings(defaultSettings);
  }

  return mapSettings(data as SettingsRow);
}

export async function saveSettings(patch: Partial<Settings>) {
  const userId = await requireUserId();
  const payload = {
    user_id: userId,
    ...(typeof patch.reducedMotion === "boolean"
      ? { reduced_motion: patch.reducedMotion }
      : {}),
    ...(patch.currency ? { currency: patch.currency } : {}),
    ...(patch.defaultPaymentMethod
      ? { default_payment_method: patch.defaultPaymentMethod }
      : {}),
    ...(typeof patch.honestyExcellentThreshold === "number"
      ? { honesty_excellent_threshold: patch.honestyExcellentThreshold }
      : {}),
    ...(typeof patch.honestyGoodThreshold === "number"
      ? { honesty_good_threshold: patch.honestyGoodThreshold }
      : {}),
    ...(typeof patch.honestyWarningThreshold === "number"
      ? { honesty_warning_threshold: patch.honestyWarningThreshold }
      : {}),
  };

  const { data, error } = await supabase
    .from("user_settings")
    .upsert(payload)
    .select(
      "reduced_motion, currency, default_payment_method, honesty_excellent_threshold, honesty_good_threshold, honesty_warning_threshold",
    )
    .single();

  if (error) {
    throw error;
  }

  return mapSettings(data as SettingsRow);
}

export async function fetchLatestOpenReconciliation() {
  await requireUserId();
  const { data, error } = await supabase
    .from("reconciliations")
    .select("id")
    .in("status", ["open", "flagged"])
    .order("end_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    return null;
  }

  return fetchReconciliationById(data.id);
}

export async function fetchReconciliationById(reconciliationId: string) {
  await requireUserId();
  const [reconciliationResult, itemsResult, paymentBreakdownResult] = await Promise.all([
    supabase
      .from("reconciliations")
      .select(
        "id, start_date, end_date, opening_inventory, restocked_inventory, closing_inventory, units_sold, expected_revenue, payments_received, shortage_or_overage, collection_rate, capital_of_sold_goods, gross_profit, notes, status",
      )
      .eq("id", reconciliationId)
      .single(),
    supabase
      .from("reconciliation_items")
      .select(
        "id, product_id, opening_quantity, restocked_quantity, adjustment_quantity, closing_quantity, units_sold, expected_revenue, capital_used, products(name)",
      )
      .eq("reconciliation_id", reconciliationId)
      .order("expected_revenue", { ascending: false }),
    supabase.rpc("get_reconciliation_payment_breakdown", {
      p_reconciliation_id: reconciliationId,
    }),
  ]);

  if (reconciliationResult.error) {
    throw reconciliationResult.error;
  }

  if (itemsResult.error) {
    throw itemsResult.error;
  }

  if (paymentBreakdownResult.error) {
    throw paymentBreakdownResult.error;
  }

  const row = reconciliationResult.data as ReconciliationRow;
  const items = (((itemsResult.data ?? []) as unknown) as ReconciliationItemRow[]).map((item) => ({
    id: item.id,
    productId: item.product_id,
    productName:
      (Array.isArray(item.products) ? item.products[0]?.name : item.products?.name) ??
      "Unknown product",
    openingQuantity: toNumber(item.opening_quantity),
    restockedQuantity: toNumber(item.restocked_quantity),
    adjustmentQuantity: toNumber(item.adjustment_quantity),
    closingQuantity: toNumber(item.closing_quantity),
    unitsSold: toNumber(item.units_sold),
    expectedRevenue: toNumber(item.expected_revenue),
    capitalUsed: toNumber(item.capital_used),
  }));
  const paymentBreakdown = (
    (paymentBreakdownResult.data ?? []) as PaymentMethodBreakdownRow[]
  ).map((item) => ({
    method: item.payment_method as PaymentMethodBreakdown["method"],
    amount: toNumber(item.amount),
    share: toNumber(item.share),
  }));

  return {
    id: row.id,
    startDate: row.start_date,
    endDate: row.end_date,
    openingInventory: toNumber(row.opening_inventory),
    restockedInventory: toNumber(row.restocked_inventory),
    closingInventory: toNumber(row.closing_inventory),
    unitsSold: toNumber(row.units_sold),
    expectedRevenue: toNumber(row.expected_revenue),
    paymentsReceived: toNumber(row.payments_received),
    shortageOrOverage: toNumber(row.shortage_or_overage),
    collectionRate: toNumber(row.collection_rate),
    capitalOfSoldGoods: toNumber(row.capital_of_sold_goods),
    grossProfit: toNumber(row.gross_profit),
    notes: row.notes ?? undefined,
    status: row.status,
    items,
    paymentBreakdown,
  } satisfies ReconciliationSummary;
}

export async function createPayment(input: PaymentInput) {
  const userId = await requireUserId();
  const { data, error } = await supabase
    .from("payments")
    .insert({
      user_id: userId,
      amount: roundCurrency(input.amount),
      payment_method: input.method,
      payment_date: input.date,
      notes: input.notes?.trim() || null,
    })
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function createCashMovement(input: CashMovementInput) {
  const userId = await requireUserId();
  const { data, error } = await supabase
    .from("cash_movements")
    .insert({
      user_id: userId,
      movement_type: input.type,
      amount: roundCurrency(input.amount),
      movement_date: input.date,
      notes: input.notes?.trim() || null,
    })
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function createInventoryAdjustment(input: InventoryAdjustmentInput) {
  const userId = await requireUserId();
  const { data, error } = await supabase
    .from("inventory_adjustments")
    .insert({
      user_id: userId,
      product_id: input.productId,
      quantity_delta: input.quantityDelta,
      adjustment_type: input.adjustmentType,
      adjustment_date: input.date,
      reason: input.reason?.trim() || null,
    })
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function createRestockEvent(input: RestockInput) {
  const userId = await requireUserId();
  const eventResult = await supabase
    .from("restock_events")
    .insert({
      user_id: userId,
      stocked_on: input.date,
      notes: input.notes?.trim() || null,
    })
    .select("id")
    .single();

  if (eventResult.error) {
    throw eventResult.error;
  }

  const eventId = eventResult.data.id;

  const stockBatchRows = await Promise.all(
    input.items.map(async (item) => {
      const batchResult = await supabase
        .from("stock_batches")
        .insert({
          user_id: userId,
          product_id: item.productId,
          quantity: item.quantity,
          unit_cost: roundCurrency(item.unitCost),
          total_capital: roundCurrency(item.quantity * item.unitCost),
          selling_price_at_time: roundCurrency(item.sellingPrice),
          expected_revenue: roundCurrency(item.quantity * item.sellingPrice),
          date_purchased: input.date,
          date_stocked: input.date,
          supplier: item.supplier?.trim() || null,
        })
        .select("id")
        .single();

      if (batchResult.error) {
        throw batchResult.error;
      }

      return {
        restock_event_id: eventId,
        product_id: item.productId,
        stock_batch_id: batchResult.data.id,
        quantity: item.quantity,
        unit_cost: roundCurrency(item.unitCost),
        selling_price: roundCurrency(item.sellingPrice),
        total_capital: roundCurrency(item.quantity * item.unitCost),
        expected_revenue: roundCurrency(item.quantity * item.sellingPrice),
      };
    }),
  );

  const itemsResult = await supabase
    .from("restock_event_items")
    .insert(stockBatchRows)
    .select();

  if (itemsResult.error) {
    throw itemsResult.error;
  }

  return {
    eventId,
    items: itemsResult.data,
  };
}

export async function createInventoryCount(input: InventoryCountInput) {
  const userId = await requireUserId();
  const countResult = await supabase
    .from("inventory_counts")
    .insert({
      user_id: userId,
      counted_on: input.date,
      notes: input.notes?.trim() || null,
    })
    .select("id")
    .single();

  if (countResult.error) {
    throw countResult.error;
  }

  const inventoryCountId = countResult.data.id;
  const itemsResult = await supabase.from("inventory_count_items").insert(
    input.items.map((item) => ({
      inventory_count_id: inventoryCountId,
      product_id: item.productId,
      expected_quantity: item.expectedQuantity,
      actual_quantity: item.actualQuantity,
      variance: item.actualQuantity - item.expectedQuantity,
    })),
  );

  if (itemsResult.error) {
    throw itemsResult.error;
  }

  const reconciliationResult = await supabase.rpc("create_reconciliation_from_count", {
    p_inventory_count_id: inventoryCountId,
  });

  if (reconciliationResult.error) {
    throw reconciliationResult.error;
  }

  return {
    inventoryCountId,
    reconciliationId:
      typeof reconciliationResult.data === "string"
        ? reconciliationResult.data
        : Array.isArray(reconciliationResult.data)
          ? String(reconciliationResult.data[0] ?? "")
          : String(reconciliationResult.data ?? ""),
  };
}

export async function updateReconciliationStatus(
  reconciliationId: string,
  status: ReconciliationSummary["status"],
  notes?: string,
) {
  const { data, error } = await supabase
    .from("reconciliations")
    .update({
      status,
      notes: notes?.trim() || null,
    })
    .eq("id", reconciliationId)
    .select("id")
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function createOperationalRealtimeChannel(onChange: () => void) {
  const userId = await requireUserId();
  const channel = supabase
    .channel(`trustally:${userId}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "payments",
        filter: `user_id=eq.${userId}`,
      },
      onChange,
    )
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "restock_events",
        filter: `user_id=eq.${userId}`,
      },
      onChange,
    )
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "inventory_counts",
        filter: `user_id=eq.${userId}`,
      },
      onChange,
    )
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "reconciliations",
        filter: `user_id=eq.${userId}`,
      },
      onChange,
    )
    .subscribe();

  return channel;
}

export async function removeRealtimeChannel(channel: RealtimeChannel) {
  await supabase.removeChannel(channel);
}

export function isProbablyOfflineError(error: unknown) {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return true;
  }

  const message =
    error instanceof Error
      ? error.message.toLowerCase()
      : typeof error === "string"
        ? error.toLowerCase()
        : "";

  return (
    message.includes("failed to fetch") ||
    message.includes("network") ||
    message.includes("offline")
  );
}

export function getErrorMessage(error: unknown) {
  if (error instanceof AuthRequiredError) {
    return error.message;
  }

  if (isPostgrestError(error)) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Something went wrong while talking to Supabase.";
}

async function requireUserId() {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const userId = session?.user?.id;

  if (!userId) {
    throw new AuthRequiredError();
  }

  return userId;
}

function mapActivityItem(row: ActivityFeedRow) {
  return {
    id: row.id,
    kind: row.kind,
    title: row.title,
    subtitle: row.subtitle,
    amount: row.amount === null ? null : toNumber(row.amount),
    secondaryAmount:
      row.secondary_amount === null ? null : toNumber(row.secondary_amount),
    date: row.activity_date,
    createdAt: row.created_at,
    notes: row.notes ?? undefined,
  } satisfies ActivityItem;
}

function mapProduct(row: ProductRow) {
  return {
    id: row.id,
    name: row.name,
    brand: row.brand ?? "",
    variant: row.variant ?? "",
    volume: row.volume === null ? null : toNumber(row.volume),
    unit: row.unit ?? "mL",
    sku: row.sku ?? "",
    category: row.category,
    defaultCost: toNumber(row.default_cost),
    sellingPrice: toNumber(row.selling_price),
    active: row.active,
  } satisfies Product;
}

function mapSettings(row: SettingsRow) {
  return {
    reducedMotion: row.reduced_motion,
    currency: row.currency,
    defaultPaymentMethod: row.default_payment_method,
    honestyExcellentThreshold: toNumber(row.honesty_excellent_threshold),
    honestyGoodThreshold: toNumber(row.honesty_good_threshold),
    honestyWarningThreshold: toNumber(row.honesty_warning_threshold),
  } satisfies Settings;
}

function roundCurrency(value: number) {
  return Number(value.toFixed(2));
}

function toNumber(value: number | string | null | undefined) {
  if (value === null || value === undefined) {
    return 0;
  }

  return typeof value === "number" ? value : Number(value);
}

function isPostgrestError(error: unknown): error is PostgrestError {
  return (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    "code" in error
  );
}
