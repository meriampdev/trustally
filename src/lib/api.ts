import { supabase } from "../utils/supabase";
import {
  AccessibleLocation,
  BoxCheckCompletion,
  CashMovement,
  CheckBoxCountInput,
  CheckBoxDraftPayload,
  CheckBoxPreview,
  CheckBoxRefillInput,
  CycleCashFloatDetail,
  CycleDetail,
  CycleSetAside,
  CycleHonestyDetail,
  CyclePaymentDetail,
  CycleStatus,
  DetectedCycle,
  DisclosureCollectionReport,
  HistoryFilter,
  HistoryItem,
  HomeDashboard,
  NonSaleRemovalInput,
  PayLaterBalance,
  PersonHonestySummary,
  PaymentReceipt,
  Product,
  ProductUpsertInput,
  ReportDrilldown,
  ReportCashFloatDetail,
  ReportPaymentDetail,
  ReportSetAside,
  ReportsSnapshot,
  Settings,
  SetupProductInput,
  StockAdditionLineInput,
} from "./types";

export async function fetchHomeDashboard(selectedLocationId?: string | null) {
  const dashboard = await rpc<Partial<HomeDashboard> | Record<string, unknown> | null>(
    "get_home_dashboard",
    selectedLocationId ? { location_id: selectedLocationId } : undefined,
  );

  return normalizeHomeDashboard(dashboard);
}

export async function fetchProducts() {
  return rpc<Product[]>("list_products");
}

export async function fetchAccessibleLocations() {
  try {
    return await rpc<AccessibleLocation[]>("list_accessible_locations");
  } catch (error) {
    if (isMissingRpcError(error, "list_accessible_locations")) {
      const { data, error: queryError } = await supabase
        .from("locations")
        .select("id, name")
        .order("created_at", { ascending: true });

      if (queryError) {
        throw queryError;
      }

      return (data ?? []).map((location, index) => ({
        id: location.id,
        name: location.name,
        role: null,
        isCurrent: index === 0,
      }));
    }

    throw error;
  }
}

export async function setCurrentLocation(locationId: string) {
  try {
    return await rpc<AccessibleLocation>("set_current_location", {
      p_location_id: locationId,
    });
  } catch (error) {
    if (isMissingRpcError(error, "set_current_location")) {
      throw new Error(
        "The latest Trustally database migration has not been applied yet, so switching and remembering locations is not available on this database.",
      );
    }

    throw error;
  }
}

export async function startInitialTracking(input: {
  locationName: string;
  products: SetupProductInput[];
  idempotencyKey: string;
}) {
  return rpc<{ locationId: string; cycleId: string }>("start_initial_tracking", {
    p_location_name: input.locationName,
    p_lines: input.products,
    p_idempotency_key: input.idempotencyKey,
  });
}

export async function addStockToActiveCycle(input: {
  lines: StockAdditionLineInput[];
  note?: string;
  idempotencyKey: string;
}) {
  return rpc<{ stockAdditionId: string; cycleId: string }>("add_stock_to_active_cycle", {
    p_lines: input.lines,
    p_note: input.note ?? null,
    p_idempotency_key: input.idempotencyKey,
  });
}

export async function fetchCheckBoxDraft() {
  const draft = await rpc<CheckBoxDraftPayload | null>("get_check_box_draft");
  if (!draft) return null;
  try {
    const float = await fetchCycleCashFloatDetail(draft.cycleId);
    return {
      ...draft,
      openingChangeFloat: float.openingChangeFloat,
      openingChangeFloatSource: float.openingChangeFloatSource,
    };
  } catch (error) {
    if (isMissingRpcError(error, "get_cycle_cash_float_detail")) return draft;
    throw error;
  }
}

export async function previewBoxCheck(input: {
  cashCollected: string;
  cashCountedBeforeWithdrawal?: string;
  closingChangeFloat?: string;
  cashAddedForChange?: string;
  cashAddedForChangeNote?: string;
  gcashCollected: string;
  mayaCollected: string;
  counts: CheckBoxCountInput[];
  nonSaleRemovals: NonSaleRemovalInput[];
}) {
  if (input.cashCountedBeforeWithdrawal !== undefined && input.closingChangeFloat !== undefined) {
    return rpc<CheckBoxPreview>("preview_box_check_with_float", {
      p_cash_counted_before_withdrawal: input.cashCountedBeforeWithdrawal,
      p_closing_change_float: input.closingChangeFloat,
      p_gcash_collected: input.gcashCollected,
      p_maya_collected: input.mayaCollected,
      p_counts: input.counts,
      p_non_sale_removals: input.nonSaleRemovals,
      p_tracked_non_sales_cash_added: input.cashAddedForChange ?? "0",
      p_cash_addition_note: input.cashAddedForChangeNote ?? null,
    });
  }
  return rpc<CheckBoxPreview>("preview_box_check", {
    p_cash_collected: input.cashCollected,
    p_gcash_collected: input.gcashCollected,
    p_maya_collected: input.mayaCollected,
    p_counts: input.counts,
    p_non_sale_removals: input.nonSaleRemovals,
  });
}

export async function completeBoxCheck(input: {
  cashCollected: string;
  cashCountedBeforeWithdrawal?: string;
  closingChangeFloat?: string;
  cashAddedForChange?: string;
  cashAddedForChangeNote?: string;
  gcashCollected: string;
  mayaCollected: string;
  counts: CheckBoxCountInput[];
  nonSaleRemovals: NonSaleRemovalInput[];
  refillItems: CheckBoxRefillInput[];
  note?: string;
  idempotencyKey: string;
}) {
  if (input.cashCountedBeforeWithdrawal !== undefined && input.closingChangeFloat !== undefined) {
    return rpc<BoxCheckCompletion>("complete_box_check_with_float", {
      p_cash_counted_before_withdrawal: input.cashCountedBeforeWithdrawal,
      p_closing_change_float: input.closingChangeFloat,
      p_gcash_collected: input.gcashCollected,
      p_maya_collected: input.mayaCollected,
      p_counts: input.counts,
      p_non_sale_removals: input.nonSaleRemovals,
      p_refill_items: input.refillItems,
      p_note: input.note ?? null,
      p_tracked_non_sales_cash_added: input.cashAddedForChange ?? "0",
      p_cash_addition_note: input.cashAddedForChangeNote ?? null,
      p_idempotency_key: input.idempotencyKey,
    });
  }
  return rpc<BoxCheckCompletion>("complete_box_check", {
    p_cash_collected: input.cashCollected,
    p_gcash_collected: input.gcashCollected,
    p_maya_collected: input.mayaCollected,
    p_counts: input.counts,
    p_non_sale_removals: input.nonSaleRemovals,
    p_refill_items: input.refillItems,
    p_note: input.note ?? null,
    p_idempotency_key: input.idempotencyKey,
  });
}

export async function recordCycleDifference(input: {
  cycleId: string;
  resolutionType: string;
  amount?: string;
  customerLabel?: string;
  itemsSummary?: string;
  dueDate?: string;
  note?: string;
}) {
  try {
    return await rpc<{
      id: string;
      cycleId: string;
      resolutionType: string;
      amount: number;
      customerLabel?: string | null;
      itemsSummary?: string | null;
      dueDate?: string | null;
      note?: string | null;
      payLaterBalanceId?: string | null;
    }>("record_cycle_difference", {
      p_cycle_id: input.cycleId,
      p_resolution_type: input.resolutionType,
      p_amount: input.amount ?? "0",
      p_customer_label: input.customerLabel ?? null,
      p_items_summary: input.itemsSummary ?? null,
      p_due_date: input.dueDate ? new Date(input.dueDate).toISOString() : null,
      p_note: input.note ?? null,
    });
  } catch (error) {
    if (isMissingRpcError(error, "record_cycle_difference")) {
      throw new Error(
        "The latest Trustally database migration has not been applied yet, so pay-later recording is not available on this database.",
      );
    }

    throw error;
  }
}

export async function fetchOutstandingBalances() {
  try {
    return await rpc<PayLaterBalance[]>("list_open_pay_later_balances");
  } catch (error) {
    if (isMissingRpcError(error, "list_open_pay_later_balances")) {
      return [];
    }

    throw error;
  }
}

export async function recordPaymentReceipt(input: {
  amount: string;
  method: string;
  receivedAt?: string;
  paymentTiming: string;
  note?: string;
  allocations?: Array<{ payLaterBalanceId: string; amount: string }>;
  autoAllocateOldest?: boolean;
  relatedCycleId?: string | null;
}) {
  return rpc<PaymentReceipt>("record_payment_receipt", {
    p_amount: input.amount,
    p_method: input.method,
    p_received_at: input.receivedAt ? new Date(input.receivedAt).toISOString() : null,
    p_payment_timing: input.paymentTiming,
    p_note: input.note ?? null,
    p_allocations: input.allocations ?? [],
    p_auto_allocate_oldest: input.autoAllocateOldest ?? false,
    p_related_cycle_id: input.relatedCycleId ?? null,
  });
}

export async function fetchCashMovements() {
  try {
    return await rpc<CashMovement[]>("list_cash_movements");
  } catch (error) {
    if (isMissingRpcError(error, "list_cash_movements")) {
      return [];
    }

    throw error;
  }
}

export async function recordCashMovement(input: {
  type: string;
  amount: string;
  person?: string;
  note?: string;
  occurredAt?: string;
}) {
  return rpc<CashMovement>("record_cash_movement", {
    p_type: input.type,
    p_amount: input.amount,
    p_person: input.person ?? null,
    p_note: input.note ?? null,
    p_occurred_at: input.occurredAt ? new Date(input.occurredAt).toISOString() : null,
  });
}

export async function fetchHistoryFeed(filter: HistoryFilter, limit = 20, offset = 0) {
  return rpc<HistoryItem[]>("get_history_feed", {
    p_filter: filter,
    p_limit: limit,
    p_offset: offset,
  });
}

export async function fetchCycleDetail(cycleId: string) {
  return rpc<CycleDetail>("get_cycle_detail", {
    p_cycle_id: cycleId,
  });
}

export async function detectCycleForTransaction(occurredAt: string) {
  return rpc<DetectedCycle>("detect_cycle_for_transaction", {
    p_occurred_at: occurredAt,
  });
}

export async function fetchCycleDisclosureAndCollection(cycleId: string) {
  return rpc<CycleHonestyDetail>("get_cycle_honesty", {
    p_cycle_id: cycleId,
  });
}

export async function fetchCyclePaymentDetail(cycleId: string) {
  const [payments, float] = await Promise.all([
    rpc<CyclePaymentDetail>("get_cycle_payment_detail", { p_cycle_id: cycleId }),
    fetchCycleCashFloatDetail(cycleId).catch((error) => {
      if (isMissingRpcError(error, "get_cycle_cash_float_detail")) return null;
      throw error;
    }),
  ]);
  return reconcileCycleCashPayments(payments, float);
}

export async function fetchCycleCashFloatDetail(cycleId: string) {
  return rpc<CycleCashFloatDetail>("get_cycle_cash_float_detail", { p_cycle_id: cycleId });
}

export async function fetchCycleSetAside(cycleId: string) {
  return rpc<CycleSetAside>("get_cycle_set_aside", { p_cycle_id: cycleId });
}

export async function fetchReportSetAside(rangeKey: string) {
  return rpc<ReportSetAside>("get_report_set_aside", {
    p_range_key: rangeKey,
    p_start_date: null,
    p_end_date: null,
  });
}

export async function updateCycleChangeFloat(input: {
  cycleId: string;
  openingChangeFloat?: string;
  closingChangeFloat?: string;
  reason: string;
}) {
  return rpc<CycleCashFloatDetail>("update_cycle_change_float", {
    p_cycle_id: input.cycleId,
    p_opening_change_float: input.openingChangeFloat ?? null,
    p_closing_change_float: input.closingChangeFloat ?? null,
    p_reason: input.reason,
  });
}

/** @deprecated Use fetchCycleDisclosureAndCollection. */
export const fetchCycleHonesty = fetchCycleDisclosureAndCollection;

export async function fetchPersonHonesty(input: {
  cycleId?: string | null;
  startAt?: string | null;
  endAt?: string | null;
}) {
  return rpc<PersonHonestySummary[]>("get_person_honesty", {
    p_cycle_id: input.cycleId ?? null,
    p_start_at: input.startAt ?? null,
    p_end_at: input.endAt ?? null,
  });
}

export async function saveBottleTakenRecord(input: {
  id?: string | null;
  takenAt: string;
  productId: string;
  quantity: number;
  personLabel?: string;
  disclosureSource: "self_reported" | "owner_recorded" | "inventory_discrepancy";
  paymentExpectation: "required" | "pay_later" | "complimentary" | "unknown";
  note?: string;
  idempotencyKey: string;
}) {
  return rpc<{ id: string; cycleId: string; duplicate: boolean }>(
    "save_bottle_taken_record",
    {
      p_id: input.id ?? null,
      p_taken_at: input.takenAt,
      p_product_id: input.productId,
      p_quantity: input.quantity,
      p_person_label: input.personLabel ?? null,
      p_disclosure_source: input.disclosureSource,
      p_payment_expectation: input.paymentExpectation,
      p_note: input.note ?? null,
      p_idempotency_key: input.idempotencyKey,
    },
  );
}

/** @deprecated Kept for callers that still send the original unclassified payload. */
export async function saveRetroactiveUnpaidEntry(input: {
  id?: string | null;
  takenAt: string;
  productId: string;
  quantity: number;
  customerLabel?: string;
  note?: string;
  idempotencyKey: string;
}) {
  return rpc<{ id: string; cycleId: string; duplicate: boolean }>(
    "save_retroactive_unpaid_entry",
    {
      p_id: input.id ?? null,
      p_taken_at: input.takenAt,
      p_product_id: input.productId,
      p_quantity: input.quantity,
      p_customer_label: input.customerLabel ?? null,
      p_note: input.note ?? null,
      p_idempotency_key: input.idempotencyKey,
    },
  );
}

export async function deleteRetroactiveUnpaidEntry(id: string) {
  return rpc<{ id: string; cycleId: string; deleted: boolean }>(
    "delete_retroactive_unpaid_entry",
    { p_id: id },
  );
}

export async function saveRetroactiveOnlinePayment(input: {
  id?: string | null;
  paidAt: string;
  amount: string;
  method: string;
  customerLabel?: string;
  referenceNumber?: string;
  note?: string;
  idempotencyKey: string;
}) {
  return rpc<{ id: string; cycleId: string; duplicate: boolean }>(
    "save_retroactive_online_payment",
    {
      p_id: input.id ?? null,
      p_paid_at: input.paidAt,
      p_amount: input.amount,
      p_method: input.method,
      p_customer_label: input.customerLabel ?? null,
      p_reference_number: input.referenceNumber ?? null,
      p_note: input.note ?? null,
      p_idempotency_key: input.idempotencyKey,
    },
  );
}

export async function deleteRetroactiveOnlinePayment(id: string) {
  return rpc<{ id: string; cycleId: string; deleted: boolean }>(
    "delete_retroactive_online_payment",
    { p_id: id },
  );
}

export async function fetchReportsSnapshot(rangeKey: string) {
  const [snapshot, balances, disclosureCollection, drilldown, paymentDetail, cashFloatDetail] = await Promise.all([
    rpc<Partial<ReportsSnapshot> | null>("get_reports_snapshot", {
      p_range_key: rangeKey,
      p_start_date: null,
      p_end_date: null,
    }),
    fetchOutstandingBalances(),
    rpc<Partial<DisclosureCollectionReport> | null>("get_disclosure_collection_report", {
      p_range_key: rangeKey,
      p_start_date: null,
      p_end_date: null,
    }).catch((error) => {
      if (isMissingRpcError(error, "get_disclosure_collection_report")) return null;
      throw error;
    }),
    rpc<Partial<ReportDrilldown> | null>("get_report_drilldown", {
      p_range_key: rangeKey,
      p_start_date: null,
      p_end_date: null,
    }).catch((error) => {
      if (isMissingRpcError(error, "get_report_drilldown")) return null;
      throw error;
    }),
    rpc<Partial<ReportPaymentDetail> | null>("get_report_payment_detail", {
      p_range_key: rangeKey,
      p_start_date: null,
      p_end_date: null,
    }).catch((error) => {
      if (isMissingRpcError(error, "get_report_payment_detail")) return null;
      throw error;
    }),
    rpc<ReportCashFloatDetail | null>("get_report_change_float_detail", {
      p_range_key: rangeKey,
      p_start_date: null,
      p_end_date: null,
    }).catch((error) => {
      if (isMissingRpcError(error, "get_report_change_float_detail")) return null;
      throw error;
    }),
  ]);

  const reconciledPaymentDetail = paymentDetail && cashFloatDetail
    ? reconcileReportCashPayments(paymentDetail as ReportPaymentDetail, cashFloatDetail)
    : paymentDetail;
  return normalizeReportsSnapshot(snapshot, rangeKey, balances, disclosureCollection, drilldown, reconciledPaymentDetail, cashFloatDetail);
}

export async function fetchSettings() {
  return rpc<Settings>("get_settings");
}

export async function updateSettings(input: Settings) {
  return rpc<Settings>("update_settings", {
    p_reduced_motion: input.reducedMotion,
    p_target_coverage_days: input.targetCoverageDays,
    p_check_reminder_days: input.checkReminderDays,
    p_low_stock_reminders: input.lowStockReminders,
    p_honesty_excellent_min: input.honestyExcellentMin,
    p_honesty_good_min: input.honestyGoodMin,
    p_honesty_attention_min: input.honestyAttentionMin,
  });
}

export async function updateSetAsideSettings(input: Settings) {
  return rpc<Settings>("update_set_aside_settings", {
    p_electricity_cost_per_hour: input.electricityCostPerHour,
    p_misc_capital_type: input.miscCapitalType,
    p_fixed_misc_capital: input.fixedMiscCapital,
    p_misc_capital_percentage: input.miscCapitalPercentage,
  });
}

export async function upsertProduct(input: ProductUpsertInput) {
  return rpc<Product>("upsert_product", {
    p_id: input.id ?? null,
    p_name: input.name,
    p_brand: input.brand ?? null,
    p_variant: input.variant ?? null,
    p_volume: input.volume ?? null,
    p_unit: input.unit ?? null,
    p_category: input.category ?? null,
    p_sku: input.sku ?? null,
    p_default_unit_cost: input.defaultUnitCost,
    p_current_selling_price: input.currentSellingPrice,
    p_active: input.active,
  });
}

async function rpc<T>(name: string, args?: Record<string, unknown>) {
  const { data, error } = await supabase.rpc(name, args);

  if (error) {
    throw error;
  }

  return data as T;
}

function isMissingRpcError(error: unknown, functionName: string) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    "message" in error &&
    (error as { code?: string }).code === "PGRST202" &&
    typeof (error as { message?: string }).message === "string" &&
    (error as { message: string }).message.includes(functionName)
  );
}

function normalizeReportsSnapshot(
  snapshot: Partial<ReportsSnapshot> | null,
  rangeKey: string,
  balances: PayLaterBalance[] = [],
  disclosureCollection: Partial<DisclosureCollectionReport> | null = null,
  drilldown: Partial<ReportDrilldown> | null = null,
  paymentDetail: Partial<ReportPaymentDetail> | null = null,
  cashFloatDetail: ReportCashFloatDetail | null = null,
): ReportsSnapshot {
  const source = (snapshot ?? {}) as Record<string, unknown>;
  const legacyMetrics =
    typeof source.metrics === "object" && source.metrics !== null
      ? (source.metrics as Record<string, unknown>)
      : null;
  const legacyItems = Array.isArray(source.items)
    ? source.items.filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
    : [];
  const expectedVsCollected = Array.isArray(snapshot?.expectedVsCollected)
    ? snapshot.expectedVsCollected
    : legacyItems.map((item, index) => ({
        label:
          typeof item.label === "string"
            ? item.label
            : typeof item.dateLabel === "string"
              ? item.dateLabel
              : typeof item.periodLabel === "string"
                ? item.periodLabel
                : typeof item.date === "string"
                  ? item.date
                  : `Period ${index + 1}`,
        expectedRevenue:
          toNumber(item.expectedRevenue) ||
          toNumber(item.totalExpectedRevenue) ||
          toNumber(item.expectedSales) ||
          toNumber(item.expected),
        totalCollected:
          toNumber(item.totalCollected) ||
          toNumber(item.paymentsReceived) ||
          toNumber(item.totalPaymentsReceived) ||
          toNumber(item.collected),
      }))
  const bottlesTaken = Array.isArray(snapshot?.bottlesTaken) ? snapshot.bottlesTaken : [];
  const honestyTrend = Array.isArray(snapshot?.honestyTrend) ? snapshot.honestyTrend : [];
  const accountedTrend = Array.isArray(snapshot?.accountedTrend) ? snapshot.accountedTrend : [];
  const productPerformance = Array.isArray(snapshot?.productPerformance)
    ? snapshot.productPerformance
    : [];
  const legacyExpectedRevenue = toNumber(legacyMetrics?.totalExpectedRevenue);
  const legacyPaymentsReceived = toNumber(legacyMetrics?.totalPaymentsReceived);
  const legacyCollectionRate =
    legacyMetrics?.collectionRate == null ? null : toNumber(legacyMetrics.collectionRate);
  const legacyGrossProfit = toNumber(legacyMetrics?.grossProfit);
  const fallbackOutstandingAmount = balances.reduce((sum, balance) => sum + balance.remainingAmount, 0);
  const hasLegacyMetricsShape = legacyMetrics !== null || Array.isArray(source.items);
  const disclosureSummary = disclosureCollection?.summary;
  const dynamicPayments = paymentDetail?.summary;
  const dynamicTotalPayments = dynamicPayments?.totalPayments ?? disclosureSummary?.totalPayments ?? 0;
  const dynamicDifference = dynamicTotalPayments - (snapshot?.summary?.expectedRevenue ?? legacyExpectedRevenue);
  const paymentCyclesById = new Map((paymentDetail?.cycles ?? []).map((cycle) => [cycle.cycleId, cycle]));
  const reportCycles = (drilldown?.cycles ?? []).map((cycle) => {
    const payments = paymentCyclesById.get(cycle.cycleId);
    if (!payments) return cycle;
    const currentlyDue = cycle.paymentRequiredAmount;
    const collectionRate = currentlyDue > 0 ? Math.min((payments.totalPayments / currentlyDue) * 100, 100) : null;
    return {
      ...cycle,
      physicalCashCollected: payments.cashPayments,
      onlinePayments: payments.onlinePayments,
      totalPayments: payments.totalPayments,
      collectionRate,
      outstandingRequiredAmount: Math.max(currentlyDue - payments.totalPayments, 0),
      unaccountedAmount: Math.max(currentlyDue - payments.totalPayments, 0),
    };
  });
  const paymentCyclesAscending = [...(paymentDetail?.cycles ?? [])].sort(
    (left, right) => new Date(left.completedAt).getTime() - new Date(right.completedAt).getTime(),
  );
  const dynamicExpectedVsCollected = expectedVsCollected.map((item, index) => ({
    ...item,
    totalCollected: paymentCyclesAscending[index]?.totalPayments ?? item.totalCollected,
  }));

  return {
    rangeKey: snapshot?.rangeKey ?? rangeKey,
    summary: {
      completedCycles: snapshot?.summary?.completedCycles ?? expectedVsCollected.length,
      expectedRevenue: snapshot?.summary?.expectedRevenue ?? legacyExpectedRevenue,
      totalCollected: snapshot?.summary?.totalCollected ?? legacyPaymentsReceived,
      paymentsReceived: dynamicTotalPayments || snapshot?.summary?.paymentsReceived || legacyPaymentsReceived,
      differenceAmount: paymentDetail ? dynamicDifference : snapshot?.summary?.differenceAmount ?? 0,
      averageHonestyRate: snapshot?.summary?.averageHonestyRate ?? legacyCollectionRate,
      averageCollectionMatchRate:
        snapshot?.summary?.averageCollectionMatchRate ?? legacyCollectionRate,
      knownPayLater:
        snapshot?.summary?.knownPayLater ??
        (hasLegacyMetricsShape ? fallbackOutstandingAmount : 0),
      accountedAmount: snapshot?.summary?.accountedAmount ?? 0,
      accountedRate: snapshot?.summary?.accountedRate ?? null,
      settledAmount: snapshot?.summary?.settledAmount ?? 0,
      settledRate: snapshot?.summary?.settledRate ?? null,
      outstandingAmount:
        snapshot?.summary?.outstandingAmount ??
        (hasLegacyMetricsShape ? fallbackOutstandingAmount : 0),
      unaccountedAmount: paymentDetail
        ? reportCycles.reduce((sum, cycle) => sum + cycle.unaccountedAmount, 0)
        : snapshot?.summary?.unaccountedAmount ?? 0,
      totalShort: paymentDetail ? Math.max(-dynamicDifference, 0) : snapshot?.summary?.totalShort ?? 0,
      totalOver: paymentDetail ? Math.max(dynamicDifference, 0) : snapshot?.summary?.totalOver ?? 0,
      bottlesTaken: snapshot?.summary?.bottlesTaken ?? 0,
      cogs: snapshot?.summary?.cogs ?? 0,
      grossProfit: snapshot?.summary?.grossProfit ?? legacyGrossProfit,
      grossMargin: snapshot?.summary?.grossMargin ?? null,
      averageCycleDurationHours: snapshot?.summary?.averageCycleDurationHours ?? null,
      averageBottlesPerDay: snapshot?.summary?.averageBottlesPerDay ?? null,
      averageRevenuePerDay: snapshot?.summary?.averageRevenuePerDay ?? null,
      averageRevenuePerCycle: snapshot?.summary?.averageRevenuePerCycle ?? null,
      totalKnownBottles: disclosureSummary?.totalKnownBottles ?? 0,
      selfReportedBottles: disclosureSummary?.selfReportedBottles ?? 0,
      ownerRecordedBottles: disclosureSummary?.ownerRecordedBottles ?? 0,
      inventoryDiscrepancyBottles: disclosureSummary?.inventoryDiscrepancyBottles ?? 0,
      unattributedMissingBottles: disclosureSummary?.unattributedMissingBottles ?? 0,
      complimentaryBottles: disclosureSummary?.complimentaryBottles ?? 0,
      unclassifiedHistoricalRecords: disclosureSummary?.unclassifiedHistoricalRecords ?? 0,
      knownUnpaidBottles: disclosureSummary?.knownUnpaidBottles ?? 0,
      knownUnpaidAmount: disclosureSummary?.knownUnpaidAmount ?? 0,
      disclosureRate: disclosureSummary?.disclosureRate ?? null,
      collectionRate:
        disclosureSummary && disclosureSummary.paymentRequiredAmount > 0
          ? Math.min((dynamicTotalPayments / disclosureSummary.paymentRequiredAmount) * 100, 100)
          : disclosureSummary?.collectionRate ?? null,
      paymentRequiredAmount: disclosureSummary?.paymentRequiredAmount ?? 0,
      payLaterAmount: disclosureSummary?.payLaterAmount ?? 0,
      complimentaryValue: disclosureSummary?.complimentaryValue ?? 0,
      totalPayments: dynamicTotalPayments,
      cashPayments: dynamicPayments?.cashPayments ?? 0,
      onlinePayments: dynamicPayments?.onlinePayments ?? 0,
      outstandingRequiredAmount: disclosureSummary
        ? Math.max(disclosureSummary.paymentRequiredAmount - dynamicTotalPayments, 0)
        : 0,
    },
    expectedVsCollected: dynamicExpectedVsCollected,
    bottlesTaken,
    honestyTrend,
    accountedTrend,
    productPerformance,
    disclosureCollectionTrend: disclosureCollection?.cycleTrend ?? [],
    knownUnpaidRecords: disclosureCollection?.knownUnpaidRecords ?? [],
    reportCycles,
    reportBottleRecords: drilldown?.bottleRecords ?? [],
    reportOnlinePayments: drilldown?.onlinePayments ?? [],
    reportPayLaterBalances: drilldown?.payLaterBalances ?? [],
    reportPaymentReceipts: drilldown?.paymentReceipts ?? [],
    reportPaymentRecords: paymentDetail?.records ?? [],
    reportCashFloats: cashFloatDetail?.cycles ?? [],
    cashFloatSummary: cashFloatDetail?.summary ?? {
      cashCounted: 0,
      cashGenerated: 0,
      cashWithdrawn: 0,
      unknownOpeningFloatCycles: 0,
    },
  };
}

function reconcileCycleCashPayments(
  payments: CyclePaymentDetail,
  float: CycleCashFloatDetail | null,
): CyclePaymentDetail {
  if (float?.cashGenerated == null) return payments;
  const legacyRecord = payments.records.find(
    (record) => record.channel === "cash" && record.source === "cycle_check_total",
  );
  const legacyCash = legacyRecord?.amount ?? 0;
  const records = legacyRecord
    ? payments.records.map((record) => record.id === legacyRecord.id ? {
        ...record,
        amount: float.cashGenerated ?? record.amount,
        note: "Customer cash generated after removing the opening change float and including interim withdrawals.",
      } : record)
    : payments.records;
  const cashPayments = payments.summary.cashPayments - legacyCash + float.cashGenerated;
  return {
    ...payments,
    summary: {
      cashPayments,
      onlinePayments: payments.summary.onlinePayments,
      totalPayments: cashPayments + payments.summary.onlinePayments,
    },
    records,
  };
}

function reconcileReportCashPayments(
  payments: ReportPaymentDetail,
  floats: ReportCashFloatDetail,
): ReportPaymentDetail {
  const floatsByCycle = new Map(floats.cycles.map((float) => [float.cycleId, float]));
  const records = payments.records.map((record) => {
    const float = floatsByCycle.get(record.cycleId);
    if (record.channel !== "cash" || record.source !== "cycle_check_total" || float?.cashGenerated == null) return record;
    return {
      ...record,
      amount: float.cashGenerated,
      note: "Customer cash generated after removing the opening change float and including interim withdrawals.",
    };
  });
  const cycles = payments.cycles.map((cycle) => {
    const float = floatsByCycle.get(cycle.cycleId);
    if (float?.cashGenerated == null) return cycle;
    const legacyCash = payments.records
      .filter((record) => record.cycleId === cycle.cycleId && record.channel === "cash" && record.source === "cycle_check_total")
      .reduce((sum, record) => sum + record.amount, 0);
    const cashPayments = cycle.cashPayments - legacyCash + float.cashGenerated;
    return { ...cycle, cashPayments, totalPayments: cashPayments + cycle.onlinePayments };
  });
  return {
    summary: {
      cashPayments: cycles.reduce((sum, cycle) => sum + cycle.cashPayments, 0),
      onlinePayments: cycles.reduce((sum, cycle) => sum + cycle.onlinePayments, 0),
      totalPayments: cycles.reduce((sum, cycle) => sum + cycle.totalPayments, 0),
    },
    cycles,
    records,
  };
}

function normalizeHomeDashboard(
  dashboard: Partial<HomeDashboard> | Record<string, unknown> | null,
): HomeDashboard {
  const source = dashboard ?? {};
  const hasLegacyFields =
    "collectionRate" in source ||
    "inventoryValue" in source ||
    "currentInventoryUnits" in source ||
    "currentCashInBox" in source ||
    "salesThisMonth" in source;

  const hasSetup =
    typeof (source as HomeDashboard).hasSetup === "boolean"
      ? Boolean((source as HomeDashboard).hasSetup)
      : Object.keys(source).length > 0 || hasLegacyFields;

  const sourceCurrentCycle = (source as HomeDashboard).currentCycle;

  const currentCycle = sourceCurrentCycle?.startedAt
    ? {
        id: sourceCurrentCycle.id ?? "legacy-cycle",
        cycleNumber: sourceCurrentCycle.cycleNumber ?? 1,
        status: normalizeCycleStatus(sourceCurrentCycle.status),
        startedAt: sourceCurrentCycle.startedAt,
        lastCheckedAt: sourceCurrentCycle.lastCheckedAt ?? null,
        startingBoxStock:
          sourceCurrentCycle.startingBoxStock ??
          toNumber((source as Record<string, unknown>).currentInventoryUnits),
        currentAvailableStock:
          sourceCurrentCycle.currentAvailableStock ??
          toNumber((source as Record<string, unknown>).currentInventoryUnits),
        retailValue:
          sourceCurrentCycle.retailValue ??
          toNumber((source as Record<string, unknown>).inventoryValue),
        cashRemoved: sourceCurrentCycle.cashRemoved ?? 0,
        cashReturned: sourceCurrentCycle.cashReturned ?? 0,
        estimatedPhysicalCash: sourceCurrentCycle.estimatedPhysicalCash ?? null,
        estimatedRemaining: sourceCurrentCycle.estimatedRemaining ?? null,
        estimatedRetailValue:
          sourceCurrentCycle.estimatedRetailValue ??
          toNumber((source as Record<string, unknown>).inventoryValue),
      }
    : null;

  return {
    hasSetup,
    locationId: (source as HomeDashboard).locationId ?? null,
    locationName: (source as HomeDashboard).locationName ?? "Your box",
    role: (source as HomeDashboard).role ?? null,
    currentCycle,
    recentResult: normalizeHomeRecentResult((source as HomeDashboard).recentResult),
    whatToBring: (source as HomeDashboard).whatToBring ?? [],
    alerts: (source as HomeDashboard).alerts ?? [],
  };
}

function normalizeHomeRecentResult(result?: HomeDashboard["recentResult"] | null) {
  if (!result) {
    return null;
  }

  return {
    ...result,
    collectionRate: result.collectionRate ?? result.collectionMatchRate ?? result.honestyRate ?? null,
    immediatePayments: result.immediatePayments ?? result.totalCollected ?? 0,
    collectionMatchRate: result.collectionMatchRate ?? result.honestyRate ?? null,
    knownPayLater: result.knownPayLater ?? 0,
    accountedAmount: result.accountedAmount ?? result.totalCollected ?? 0,
    accountedRate: result.accountedRate ?? result.honestyRate ?? null,
    settledAmount: result.settledAmount ?? result.totalCollected ?? 0,
    settledRate: result.settledRate ?? result.honestyRate ?? null,
    outstandingAmount: result.outstandingAmount ?? 0,
    unaccountedAmount: result.unaccountedAmount ?? 0,
  };
}

function toNumber(value: unknown) {
  return typeof value === "number"
    ? value
    : typeof value === "string"
      ? Number(value) || 0
      : 0;
}

function normalizeCycleStatus(value: unknown): CycleStatus {
  return value === "ACTIVE" ||
    value === "CHECKING" ||
    value === "COMPLETED" ||
    value === "VOIDED"
    ? value
    : "ACTIVE";
}
