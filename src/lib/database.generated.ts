// Generated-schema compatibility surface for the disclosure/collection migration.
// Keep in sync with `supabase gen types` when a full generated schema is introduced.
import type {
  CycleHonestyDetail,
  BusinessAccountingReport,
  CycleCashFloatDetail,
  CyclePaymentDetail,
  DisclosureSource,
  Expense,
  ExpenseCategory,
  InventoryRestock,
  PuresafeCostSettings,
  PaymentExpectation,
  PersonHonestySummary,
  ReportPaymentDetail,
  ReportCashFloatDetail,
  CycleSetAside,
  ReportSetAside,
} from "./types";

export interface DisclosureCollectionDatabaseTypes {
  Tables: {
    retroactive_unpaid_entries: {
      Row: {
        id: string;
        location_id: string;
        cycle_id: string;
        taken_at: string;
        product_id: string;
        quantity: number;
        unit_price_snapshot: number;
        confirmed_amount: number;
        customer_label: string | null;
        note: string | null;
        idempotency_key: string;
        created_by: string;
        created_at: string;
        updated_at: string;
        disclosure_source: DisclosureSource;
        payment_expectation: PaymentExpectation;
        classification_recorded_at: string | null;
      };
      Insert: {
        disclosure_source?: DisclosureSource;
        payment_expectation?: PaymentExpectation;
        classification_recorded_at?: string | null;
      };
      Update: {
        disclosure_source?: DisclosureSource;
        payment_expectation?: PaymentExpectation;
        classification_recorded_at?: string | null;
      };
    };
  };
  Functions: {
    create_inventory_restock: {
      Args: { p_product_id: string; p_quantity: number; p_occurred_at: string; p_total_amount_paid: string; p_unit_cost_override?: string | null; p_selling_price?: string | null; p_supplier?: string | null; p_receipt_reference?: string | null; p_notes?: string | null; p_puresafe_detail?: Record<string, unknown>; p_idempotency_key: string };
      Returns: { restockId: string; stockAdditionId: string; cycleId: string };
    };
    list_inventory_restocks: {
      Args: { p_start_at?: string | null; p_end_at?: string | null };
      Returns: InventoryRestock[];
    };
    get_puresafe_cost_settings: {
      Args: { p_product_id: string };
      Returns: PuresafeCostSettings;
    };
    get_business_accounting_report: {
      Args: { p_start_at?: string | null; p_end_at?: string | null };
      Returns: BusinessAccountingReport;
    };
    list_expenses: {
      Args: { p_location_id: string };
      Returns: Expense[];
    };
    save_expense: {
      Args: {
        p_location_id: string;
        p_id?: string | null;
        p_incurred_on?: string;
        p_category?: ExpenseCategory;
        p_description?: string | null;
        p_amount?: string;
      };
      Returns: Expense;
    };
    archive_expense: {
      Args: { p_expense_id: string };
      Returns: { id: string; archived: boolean };
    };
    save_bottle_taken_record: {
      Args: {
        p_id: string | null;
        p_taken_at: string;
        p_product_id: string;
        p_quantity: number;
        p_person_label: string | null;
        p_disclosure_source: Exclude<DisclosureSource, "unknown">;
        p_payment_expectation: PaymentExpectation;
        p_note?: string | null;
        p_idempotency_key?: string;
      };
      Returns: { id: string; cycleId: string; duplicate: boolean };
    };
    get_cycle_honesty: {
      Args: { p_cycle_id: string };
      Returns: CycleHonestyDetail;
    };
    get_person_honesty: {
      Args: { p_cycle_id?: string | null; p_start_at?: string | null; p_end_at?: string | null };
      Returns: PersonHonestySummary[];
    };
    get_cycle_payment_detail: {
      Args: { p_cycle_id: string };
      Returns: CyclePaymentDetail;
    };
    get_report_payment_detail: {
      Args: { p_range_key?: string; p_start_date?: string | null; p_end_date?: string | null };
      Returns: ReportPaymentDetail;
    };
    get_cycle_cash_float_detail: {
      Args: { p_cycle_id: string };
      Returns: CycleCashFloatDetail;
    };
    get_report_change_float_detail: {
      Args: { p_range_key?: string; p_start_date?: string | null; p_end_date?: string | null };
      Returns: ReportCashFloatDetail;
    };
    get_cycle_set_aside: {
      Args: { p_cycle_id: string };
      Returns: CycleSetAside;
    };
    save_cycle_set_aside_actual: {
      Args: {
        p_cycle_id: string;
        p_actual_puresafe_capital: string;
        p_actual_other_products_capital: string;
        p_actual_electricity_share: string;
        p_actual_to_stash_cash: string;
        p_note?: string | null;
      };
      Returns: CycleSetAside;
    };
    get_report_set_aside: {
      Args: { p_range_key?: string; p_start_date?: string | null; p_end_date?: string | null };
      Returns: ReportSetAside;
    };
    update_cycle_change_float: {
      Args: {
        p_cycle_id: string;
        p_opening_change_float?: string | null;
        p_closing_change_float?: string | null;
        p_reason: string;
      };
      Returns: CycleCashFloatDetail;
    };
    correct_completed_box_cycle: {
      Args: {
        p_cycle_id: string;
        p_cash_counted_before_withdrawal: string;
        p_closing_change_float: string;
        p_gcash_collected: string;
        p_maya_collected: string;
        p_counts: Array<{ productId: string; endingQuantity: string }>;
        p_reason: string;
      };
      Returns: { cycleId: string; corrected: boolean };
    };
  };
}
