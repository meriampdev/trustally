// Generated-schema compatibility surface for the disclosure/collection migration.
// Keep in sync with `supabase gen types` when a full generated schema is introduced.
import type {
  CycleHonestyDetail,
  CycleCashFloatDetail,
  CyclePaymentDetail,
  DisclosureSource,
  PaymentExpectation,
  PersonHonestySummary,
  ReportPaymentDetail,
  ReportCashFloatDetail,
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
    update_cycle_change_float: {
      Args: {
        p_cycle_id: string;
        p_opening_change_float?: string | null;
        p_closing_change_float?: string | null;
        p_reason: string;
      };
      Returns: CycleCashFloatDetail;
    };
  };
}
