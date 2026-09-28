-- Trustally payment and reserve workflow V2.
-- Additive only: existing records, identifiers, completed-cycle values, and
-- historical Actual Set Aside snapshots remain intact.

begin;

alter table public.location_settings
  add column if not exists puresafe_reserve_goal numeric(12,2) not null default 1300,
  add column if not exists other_products_reserve_goal numeric(12,2) not null default 600,
  add column if not exists electricity_reserve_goal numeric(12,2) not null default 2000;

alter table public.location_settings
  drop constraint if exists location_settings_reserve_goals_nonnegative,
  add constraint location_settings_reserve_goals_nonnegative check (
    puresafe_reserve_goal >= 0 and other_products_reserve_goal >= 0 and electricity_reserve_goal >= 0
  );

alter table public.box_cycles
  add column if not exists unionbank_collected numeric(12,2) not null default 0,
  add column if not exists bpi_collected numeric(12,2) not null default 0,
  add column if not exists puresafe_reserve_goal_snapshot numeric(12,2),
  add column if not exists other_products_reserve_goal_snapshot numeric(12,2),
  add column if not exists electricity_reserve_goal_snapshot numeric(12,2);

alter table public.box_cycles
  drop constraint if exists box_cycles_added_channels_nonnegative,
  add constraint box_cycles_added_channels_nonnegative check (unionbank_collected >= 0 and bpi_collected >= 0),
  drop constraint if exists box_cycles_reserve_goal_snapshots_nonnegative,
  add constraint box_cycles_reserve_goal_snapshots_nonnegative check (
    (puresafe_reserve_goal_snapshot is null or puresafe_reserve_goal_snapshot >= 0)
    and (other_products_reserve_goal_snapshot is null or other_products_reserve_goal_snapshot >= 0)
    and (electricity_reserve_goal_snapshot is null or electricity_reserve_goal_snapshot >= 0)
  );

alter table public.payment_receipts drop constraint if exists payment_receipts_method_check;
alter table public.payment_receipts add constraint payment_receipts_method_check
  check (method in ('CASH','GCASH','MAYA','UNIONBANK','BPI','BANK','OTHER'));
alter table public.retroactive_online_payments drop constraint if exists retroactive_online_payments_method_check;
alter table public.retroactive_online_payments add constraint retroactive_online_payments_method_check
  check (method in ('GCASH','MAYA','UNIONBANK','BPI','BANK','OTHER'));

alter table public.cycle_set_aside_actuals
  add column if not exists credit_puresafe_capital numeric(12,2) not null default 0,
  add column if not exists credit_other_products_capital numeric(12,2) not null default 0,
  add column if not exists credit_electricity_share numeric(12,2) not null default 0,
  add column if not exists credit_contingency numeric(12,2) not null default 0,
  add column if not exists cleared_puresafe_credit numeric(12,2) not null default 0,
  add column if not exists cleared_other_products_credit numeric(12,2) not null default 0,
  add column if not exists cleared_electricity_credit numeric(12,2) not null default 0,
  add column if not exists cleared_contingency_credit numeric(12,2) not null default 0;

alter table public.cycle_set_aside_actuals
  drop constraint if exists cycle_set_aside_actuals_credit_nonnegative,
  add constraint cycle_set_aside_actuals_credit_nonnegative check (
    least(credit_puresafe_capital,credit_other_products_capital,credit_electricity_share,credit_contingency,
      cleared_puresafe_credit,cleared_other_products_credit,cleared_electricity_credit,cleared_contingency_credit) >= 0
  );

alter table public.expenses add column if not exists reserve_paid_from text;
alter table public.expenses drop constraint if exists expenses_reserve_paid_from_check;
alter table public.expenses add constraint expenses_reserve_paid_from_check check (
  reserve_paid_from is null or reserve_paid_from in ('PURESAFE','OTHER_PRODUCTS','ELECTRICITY','CONTINGENCY')
);

create table if not exists public.reserve_goal_hits (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references public.locations(id) on delete cascade,
  cycle_id uuid references public.box_cycles(id) on delete set null,
  reserve_kind text not null check (reserve_kind in ('PURESAFE','OTHER_PRODUCTS','ELECTRICITY')),
  goal_amount numeric(12,2) not null check (goal_amount >= 0),
  funded_balance numeric(12,2) not null,
  hit_at timestamptz not null default now(),
  unique(cycle_id,reserve_kind)
);
create index if not exists reserve_goal_hits_location_date_idx on public.reserve_goal_hits(location_id,hit_at desc);
alter table public.reserve_goal_hits enable row level security;
revoke all on public.reserve_goal_hits from public,anon,authenticated;

create or replace function public.snapshot_cycle_set_aside_settings()
returns trigger language plpgsql set search_path=public as $$
declare v_settings public.location_settings%rowtype;
begin
  if new.status='COMPLETED' and (old.status is distinct from 'COMPLETED' or new.set_aside_snapshotted_at is null) then
    select * into v_settings from public.location_settings where location_id=new.location_id;
    new.electricity_cost_per_hour_snapshot:=coalesce(new.electricity_cost_per_hour_snapshot,v_settings.electricity_cost_per_hour,5);
    new.misc_capital_type_snapshot:=coalesce(new.misc_capital_type_snapshot,v_settings.misc_capital_type,'DISABLED');
    new.fixed_misc_capital_snapshot:=coalesce(new.fixed_misc_capital_snapshot,v_settings.fixed_misc_capital,0);
    new.misc_capital_percentage_snapshot:=coalesce(new.misc_capital_percentage_snapshot,v_settings.misc_capital_percentage,0);
    new.puresafe_reserve_goal_snapshot:=coalesce(new.puresafe_reserve_goal_snapshot,v_settings.puresafe_reserve_goal,1300);
    new.other_products_reserve_goal_snapshot:=coalesce(new.other_products_reserve_goal_snapshot,v_settings.other_products_reserve_goal,600);
    new.electricity_reserve_goal_snapshot:=coalesce(new.electricity_reserve_goal_snapshot,v_settings.electricity_reserve_goal,2000);
    new.set_aside_snapshotted_at:=coalesce(new.set_aside_snapshotted_at,now());
  end if;
  return new;
end;
$$;

-- Expand method validation in the existing receipt and retroactive-payment RPCs.
do $migration$
declare v_definition text; v_updated text;
begin
  select pg_get_functiondef('public.record_payment_receipt(text,text,timestamptz,text,text,jsonb,boolean,uuid)'::regprocedure) into v_definition;
  v_updated:=replace(v_definition,$old$('CASH', 'GCASH', 'MAYA', 'BANK', 'OTHER')$old$,$new$('CASH', 'GCASH', 'MAYA', 'UNIONBANK', 'BPI', 'BANK', 'OTHER')$new$);
  if v_updated=v_definition then raise exception 'Could not extend record_payment_receipt payment methods.'; end if;
  execute v_updated;
  select pg_get_functiondef('public.save_retroactive_online_payment(uuid,timestamptz,text,text,text,text,text,uuid)'::regprocedure) into v_definition;
  v_updated:=replace(v_definition,$old$('GCASH', 'MAYA', 'BANK', 'OTHER')$old$,$new$('GCASH', 'MAYA', 'UNIONBANK', 'BPI', 'BANK', 'OTHER')$new$);
  if v_updated=v_definition then raise exception 'Could not extend retroactive payment methods.'; end if;
  execute v_updated;
end;
$migration$;

-- Preserve the existing itemized payment composition and append the two new
-- aggregate channels recorded at box check.
do $migration$
begin
  if to_regprocedure('public.get_cycle_payment_detail_before_channels(uuid)') is null then
    alter function public.get_cycle_payment_detail(uuid) rename to get_cycle_payment_detail_before_channels;
  end if;
end;
$migration$;

create or replace function public.get_cycle_payment_detail(p_cycle_id uuid)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare v_cycle public.box_cycles%rowtype; v_base jsonb; v_records jsonb; v_union numeric(12,2); v_bpi numeric(12,2); v_cash numeric(12,2); v_online numeric(12,2);
begin
  select * into v_cycle from public.box_cycles where id=p_cycle_id;
  if not found then raise exception 'Cycle not found.'; end if;
  perform public.require_location_access(v_cycle.location_id,false);
  v_base:=public.get_cycle_payment_detail_before_channels(p_cycle_id);
  v_union:=coalesce(v_cycle.unionbank_collected,0); v_bpi:=coalesce(v_cycle.bpi_collected,0);
  -- A CASH receipt related to the active cycle is already represented by the
  -- physical cash count at completion. Keep later cash assignments, but do not
  -- add a pre-check receipt to that aggregate a second time.
  select coalesce(jsonb_agg(payment order by (payment->>'occurredAt')::timestamptz desc),'[]'::jsonb)
  into v_records
  from jsonb_array_elements(coalesce(v_base->'records','[]'::jsonb)) payment
  where not (
    v_cycle.completed_at is not null
    and payment->>'source'='direct_receipt'
    and payment->>'method'='CASH'
    and (payment->>'occurredAt')::timestamptz<=v_cycle.completed_at
  );
  v_records:=v_records
    || case when v_union>0 then jsonb_build_array(jsonb_build_object('id','cycle-unionbank-'||v_cycle.id,'cycleId',v_cycle.id,'cycleLabel','Cycle #'||v_cycle.cycle_number,'occurredAt',coalesce(v_cycle.completed_at,v_cycle.updated_at),'recordedAt',coalesce(v_cycle.completed_at,v_cycle.updated_at),'amount',v_union,'method','UNIONBANK','channel','online','source','cycle_check_total','note','Aggregate UnionBank amount entered at box check.','isItemized',false)) else '[]'::jsonb end
    || case when v_bpi>0 then jsonb_build_array(jsonb_build_object('id','cycle-bpi-'||v_cycle.id,'cycleId',v_cycle.id,'cycleLabel','Cycle #'||v_cycle.cycle_number,'occurredAt',coalesce(v_cycle.completed_at,v_cycle.updated_at),'recordedAt',coalesce(v_cycle.completed_at,v_cycle.updated_at),'amount',v_bpi,'method','BPI','channel','online','source','cycle_check_total','note','Aggregate BPI amount entered at box check.','isItemized',false)) else '[]'::jsonb end;
  select round(coalesce(sum((payment->>'amount')::numeric) filter(where payment->>'channel'='cash'),0),2),
         round(coalesce(sum((payment->>'amount')::numeric) filter(where payment->>'channel'='online'),0),2)
  into v_cash,v_online from jsonb_array_elements(v_records) payment;
  return v_base||jsonb_build_object('summary',jsonb_build_object(
    'cashPayments',v_cash,
    'onlinePayments',v_online,
    'totalPayments',round(v_cash+v_online,2)
  ),'records',v_records);
end;
$$;

create or replace function public.get_cycle_recorded_online_totals(p_cycle_id uuid)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare v_cycle public.box_cycles%rowtype; v_detail jsonb; v_gcash numeric:=0; v_maya numeric:=0; v_union numeric:=0; v_bpi numeric:=0; v_bank numeric:=0; v_other numeric:=0;
begin
  select * into v_cycle from public.box_cycles where id=p_cycle_id;
  if not found then raise exception 'Cycle not found.'; end if;
  perform public.require_location_access(v_cycle.location_id,false);
  v_detail:=public.get_cycle_payment_detail(p_cycle_id);
  select round(coalesce(sum((p->>'amount')::numeric) filter(where p->>'method'='GCASH'),0),2),round(coalesce(sum((p->>'amount')::numeric) filter(where p->>'method'='MAYA'),0),2),round(coalesce(sum((p->>'amount')::numeric) filter(where p->>'method'='UNIONBANK'),0),2),round(coalesce(sum((p->>'amount')::numeric) filter(where p->>'method'='BPI'),0),2),round(coalesce(sum((p->>'amount')::numeric) filter(where p->>'method'='BANK'),0),2),round(coalesce(sum((p->>'amount')::numeric) filter(where p->>'method' not in ('GCASH','MAYA','UNIONBANK','BPI','BANK')),0),2)
  into v_gcash,v_maya,v_union,v_bpi,v_bank,v_other
  from jsonb_array_elements(coalesce(v_detail->'records','[]'::jsonb)) p
  where p->>'channel'='online' and p->>'source'<>'cycle_check_total';
  return jsonb_build_object('gcash',v_gcash,'maya',v_maya,'unionbank',v_union,'bpi',v_bpi,'bank',v_bank,'other',v_other,'eligible',v_maya+v_union+v_bpi+v_bank,'total',v_gcash+v_maya+v_union+v_bpi+v_bank+v_other);
end;
$$;

create or replace function public.preview_box_check_with_float(
  p_cash_counted_before_withdrawal text,p_closing_change_float text,p_gcash_collected text,p_maya_collected text,
  p_unionbank_collected text,p_bpi_collected text,p_counts jsonb,p_non_sale_removals jsonb,
  p_tracked_non_sales_cash_added text,p_cash_addition_note text
) returns jsonb language plpgsql security definer set search_path=public as $$
declare v_preview jsonb; v_union numeric(12,2):=round(coalesce(nullif(btrim(coalesce(p_unionbank_collected,'')),'')::numeric,0),2); v_bpi numeric(12,2):=round(coalesce(nullif(btrim(coalesce(p_bpi_collected,'')),'')::numeric,0),2); v_expected numeric; v_total numeric; v_rate numeric;
begin
  if v_union<0 or v_bpi<0 then raise exception 'Payment amounts cannot be negative.'; end if;
  v_preview:=public.preview_box_check_with_float(p_cash_counted_before_withdrawal,p_closing_change_float,p_gcash_collected,p_maya_collected,p_counts,p_non_sale_removals,p_tracked_non_sales_cash_added,p_cash_addition_note);
  v_expected:=coalesce((v_preview#>>'{totals,expectedRevenue}')::numeric,0);
  v_total:=round(coalesce((v_preview#>>'{totals,totalCollected}')::numeric,0)+v_union+v_bpi,2);
  v_rate:=case when v_expected>0 then round(v_total/v_expected*100,2) else null end;
  return jsonb_set(v_preview,'{totals}',(v_preview->'totals')||jsonb_build_object('unionbankCollected',v_union,'bpiCollected',v_bpi,'totalCollected',v_total,'differenceAmount',round(v_total-v_expected,2),'honestyRate',v_rate));
end;
$$;

create or replace function public.complete_box_check_with_float(
  p_cash_counted_before_withdrawal text,p_closing_change_float text,p_gcash_collected text,p_maya_collected text,
  p_unionbank_collected text,p_bpi_collected text,p_counts jsonb,p_non_sale_removals jsonb,p_refill_items jsonb,p_note text,
  p_tracked_non_sales_cash_added text,p_cash_addition_note text,p_idempotency_key uuid
) returns jsonb language plpgsql security definer set search_path=public as $$
declare v_user uuid:=auth.uid(); v_preview jsonb; v_response jsonb; v_cycle_id uuid; v_expected numeric; v_total numeric; v_union numeric(12,2):=round(coalesce(nullif(btrim(coalesce(p_unionbank_collected,'')),'')::numeric,0),2); v_bpi numeric(12,2):=round(coalesce(nullif(btrim(coalesce(p_bpi_collected,'')),'')::numeric,0),2);
begin
  if v_user is null then raise exception 'Authentication required.'; end if;
  select response into v_response from public.client_mutations where idempotency_key=p_idempotency_key and user_id=v_user and mutation_name='complete_box_check';
  if found then return v_response; end if;
  v_preview:=public.preview_box_check_with_float(p_cash_counted_before_withdrawal,p_closing_change_float,p_gcash_collected,p_maya_collected,p_unionbank_collected,p_bpi_collected,p_counts,p_non_sale_removals,p_tracked_non_sales_cash_added,p_cash_addition_note);
  v_response:=public.complete_box_check_with_float(p_cash_counted_before_withdrawal,p_closing_change_float,p_gcash_collected,p_maya_collected,p_counts,p_non_sale_removals,p_refill_items,p_note,p_tracked_non_sales_cash_added,p_cash_addition_note,p_idempotency_key);
  v_cycle_id:=(v_response->>'completedCycleId')::uuid;
  v_expected:=coalesce((v_preview#>>'{totals,expectedRevenue}')::numeric,0); v_total:=coalesce((v_preview#>>'{totals,totalCollected}')::numeric,0);
  update public.box_cycles set unionbank_collected=v_union,bpi_collected=v_bpi,total_collected=v_total,difference_amount=round(v_total-v_expected,2),honesty_rate=case when v_expected>0 then round(v_total/v_expected*100,2) else null end where id=v_cycle_id;
  perform public.sync_cycle_financials(v_cycle_id);
  perform public.refresh_cycle_honesty(v_cycle_id);
  v_response:=jsonb_set(v_response,'{preview}',v_preview);
  update public.client_mutations set response=v_response where idempotency_key=p_idempotency_key and user_id=v_user and mutation_name='complete_box_check';
  return v_response;
end;
$$;

create or replace function public.correct_completed_box_cycle(
  p_cycle_id uuid,p_cash_counted_before_withdrawal text,p_closing_change_float text,p_gcash_collected text,p_maya_collected text,
  p_unionbank_collected text,p_bpi_collected text,p_counts jsonb,p_reason text
) returns jsonb language plpgsql security definer set search_path=public as $$
declare result jsonb; corrected public.box_cycles%rowtype; later public.box_cycles%rowtype; v_union numeric(12,2):=round(coalesce(nullif(btrim(coalesce(p_unionbank_collected,'')),'')::numeric,0),2); v_bpi numeric(12,2):=round(coalesce(nullif(btrim(coalesce(p_bpi_collected,'')),'')::numeric,0),2);
begin
  if v_union<0 or v_bpi<0 then raise exception 'Payment amounts cannot be negative.'; end if;
  select * into corrected from public.box_cycles where id=p_cycle_id;
  result:=public.correct_completed_box_cycle(p_cycle_id,p_cash_counted_before_withdrawal,p_closing_change_float,p_gcash_collected,p_maya_collected,p_counts,p_reason);
  update public.box_cycles set unionbank_collected=v_union,bpi_collected=v_bpi where id=p_cycle_id;
  for later in select * from public.box_cycles where location_id=corrected.location_id and status='COMPLETED' and cycle_number>=corrected.cycle_number loop
    update public.box_cycles set
      total_collected=round(coalesce(cash_collected,0)+coalesce(gcash_collected,0)+coalesce(maya_collected,0)+coalesce(unionbank_collected,0)+coalesce(bpi_collected,0),2),
      difference_amount=round(coalesce(cash_collected,0)+coalesce(gcash_collected,0)+coalesce(maya_collected,0)+coalesce(unionbank_collected,0)+coalesce(bpi_collected,0)-coalesce(expected_revenue,0),2),
      honesty_rate=case when coalesce(expected_revenue,0)>0 then round((coalesce(cash_collected,0)+coalesce(gcash_collected,0)+coalesce(maya_collected,0)+coalesce(unionbank_collected,0)+coalesce(bpi_collected,0))/expected_revenue*100,2) else null end
    where id=later.id;
    perform public.sync_cycle_financials(later.id); perform public.refresh_cycle_honesty(later.id);
  end loop;
  return result;
end;
$$;

do $migration$
begin
  if to_regprocedure('public.get_cycle_detail_before_channels(uuid)') is null then alter function public.get_cycle_detail(uuid) rename to get_cycle_detail_before_channels; end if;
end;
$migration$;

create or replace function public.get_cycle_detail(p_cycle_id uuid)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare base jsonb; c public.box_cycles%rowtype;
begin
  select * into c from public.box_cycles where id=p_cycle_id; if not found then raise exception 'Cycle not found.'; end if;
  perform public.require_location_access(c.location_id,false);
  base:=public.get_cycle_detail_before_channels(p_cycle_id);
  return jsonb_set(base,'{totals}',(base->'totals')||jsonb_build_object('unionbankCollected',coalesce(c.unionbank_collected,0),'bpiCollected',coalesce(c.bpi_collected,0)));
end;
$$;

-- Settings expose reserve goals without changing historical cycle snapshots.
create or replace function public.get_settings()
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare v_location uuid; v_result jsonb;
begin
  if auth.uid() is null then raise exception 'Authentication required.'; end if;
  v_location:=public.get_current_location_id();
  if v_location is null then
    select jsonb_build_object('currency',currency,'reducedMotion',reduced_motion,'targetCoverageDays',5,'checkReminderDays',2,'lowStockReminders',true,'honestyExcellentMin',98,'honestyGoodMin',95,'honestyAttentionMin',90,'electricityCostPerHour',5,'puresafeReserveGoal',1300,'otherProductsReserveGoal',600,'electricityReserveGoal',2000,'miscCapitalType','disabled','fixedMiscCapital',0,'miscCapitalPercentage',0) into v_result from public.user_settings where user_id=auth.uid();
    return coalesce(v_result,'{}'::jsonb);
  end if;
  perform public.require_location_access(v_location,false);
  select jsonb_build_object('currency',us.currency,'reducedMotion',us.reduced_motion,'targetCoverageDays',ls.target_coverage_days,'checkReminderDays',ls.check_reminder_days,'lowStockReminders',ls.low_stock_reminders,'honestyExcellentMin',ls.honesty_excellent_min,'honestyGoodMin',ls.honesty_good_min,'honestyAttentionMin',ls.honesty_attention_min,'electricityCostPerHour',ls.electricity_cost_per_hour,'puresafeReserveGoal',ls.puresafe_reserve_goal,'otherProductsReserveGoal',ls.other_products_reserve_goal,'electricityReserveGoal',ls.electricity_reserve_goal,'miscCapitalType',lower(ls.misc_capital_type),'fixedMiscCapital',ls.fixed_misc_capital,'miscCapitalPercentage',ls.misc_capital_percentage)
  into v_result from public.user_settings us join public.location_settings ls on ls.location_id=v_location where us.user_id=auth.uid();
  return v_result;
end;
$$;

create or replace function public.update_set_aside_settings(
  p_electricity_cost_per_hour numeric,p_misc_capital_type text,p_fixed_misc_capital numeric,p_misc_capital_percentage numeric,
  p_puresafe_reserve_goal numeric,p_other_products_reserve_goal numeric,p_electricity_reserve_goal numeric
) returns jsonb language plpgsql security definer set search_path=public as $$
declare v_location uuid:=public.require_current_location_id(); v_previous jsonb; v_type text:=upper(coalesce(p_misc_capital_type,'DISABLED'));
begin
  perform public.require_location_access(v_location,true);
  if least(coalesce(p_electricity_cost_per_hour,-1),coalesce(p_puresafe_reserve_goal,-1),coalesce(p_other_products_reserve_goal,-1),coalesce(p_electricity_reserve_goal,-1))<0 then raise exception 'Reserve goals and electricity cost must be zero or greater.'; end if;
  if v_type not in ('DISABLED','FIXED','PERCENTAGE') then raise exception 'Unsupported miscellaneous capital type.'; end if;
  select to_jsonb(ls) into v_previous from public.location_settings ls where location_id=v_location;
  update public.location_settings set electricity_cost_per_hour=round(p_electricity_cost_per_hour,2),puresafe_reserve_goal=round(p_puresafe_reserve_goal,2),other_products_reserve_goal=round(p_other_products_reserve_goal,2),electricity_reserve_goal=round(p_electricity_reserve_goal,2),misc_capital_type=v_type,fixed_misc_capital=round(coalesce(p_fixed_misc_capital,0),2),misc_capital_percentage=round(coalesce(p_misc_capital_percentage,0),4),updated_at=now() where location_id=v_location;
  perform public.record_audit_log(v_location,'update','set_aside_settings',v_location,v_previous,(select to_jsonb(ls) from public.location_settings ls where location_id=v_location),null);
  return public.get_settings();
end;
$$;

-- Reserve-funded operating expenses. Automatic restock expenses remain linked
-- to stock additions and are deducted exactly once by the reserve calculator.
create or replace function public.expense_to_json(p_expense public.expenses)
returns jsonb language sql stable set search_path=public as $$
  select jsonb_build_object('id',p_expense.id,'locationId',p_expense.location_id,'incurredOn',p_expense.incurred_on,'category',p_expense.category,'description',p_expense.description,'amount',p_expense.amount,'expenseType',p_expense.expense_type,'productId',p_expense.product_id,'restockId',p_expense.stock_addition_item_id,'affectsInventoryCost',p_expense.affects_inventory_cost,'reservePaidFrom',p_expense.reserve_paid_from,'createdAt',p_expense.created_at,'updatedAt',p_expense.updated_at)
$$;

create or replace function public.save_expense(p_location_id uuid,p_id uuid,p_incurred_on date,p_category text,p_description text,p_amount text,p_reserve_paid_from text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_expense public.expenses%rowtype; v_amount numeric(12,2); v_reserve text:=nullif(upper(btrim(coalesce(p_reserve_paid_from,''))),'');
begin
  perform public.require_location_access(p_location_id,true);
  v_amount:=round(nullif(btrim(coalesce(p_amount,'')),'')::numeric,2);
  if v_amount<=0 then raise exception 'Expense amount must be greater than zero.'; end if;
  if p_category='Inventory' then raise exception 'Inventory expenses are created automatically from restocks.'; end if;
  if v_reserve is not null and v_reserve not in ('PURESAFE','OTHER_PRODUCTS','ELECTRICITY','CONTINGENCY') then raise exception 'Unsupported reserve.'; end if;
  if p_id is null then
    insert into public.expenses(location_id,incurred_on,category,description,amount,expense_type,affects_inventory_cost,reserve_paid_from) values(p_location_id,p_incurred_on,p_category,nullif(btrim(coalesce(p_description,'')),''),v_amount,'OPERATING',false,v_reserve) returning * into v_expense;
  else
    if exists(select 1 from public.expenses where id=p_id and stock_addition_item_id is not null) then raise exception 'Edit this purchase from Restock history.'; end if;
    update public.expenses set incurred_on=p_incurred_on,category=p_category,description=nullif(btrim(coalesce(p_description,'')),''),amount=v_amount,reserve_paid_from=v_reserve,updated_at=now() where id=p_id and location_id=p_location_id and archived_at is null returning * into v_expense;
    if not found then raise exception 'Expense not found.'; end if;
  end if;
  return public.expense_to_json(v_expense);
end;
$$;

-- Physical reserve balance and online-credit balance remain separate. The
-- funded balance is their sum and is the only value used to determine a goal.
create or replace function public.get_set_aside_fund_balances(p_location_id uuid,p_as_of timestamptz default now())
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare v_base public.set_aside_fund_baselines%rowtype; v_settings public.location_settings%rowtype; v_started timestamptz;
  ap numeric:=0; ao numeric:=0; ae numeric:=0; ac numeric:=0; cp numeric:=0; co numeric:=0; ce numeric:=0; cc numeric:=0; xp numeric:=0; xo numeric:=0; xe numeric:=0; xc numeric:=0;
  up numeric:=0; uo numeric:=0; ep numeric:=0; eo numeric:=0; ee numeric:=0; ec numeric:=0;
  pp numeric; po numeric; pe numeric; pc numeric; wp numeric; wo numeric; we numeric; wc numeric; fp numeric; fo numeric; fe numeric; fc numeric;
begin
  perform public.require_location_access(p_location_id,false);
  select * into v_base from public.set_aside_fund_baselines where location_id=p_location_id;
  select * into v_settings from public.location_settings where location_id=p_location_id;
  v_started:=coalesce(v_base.tracking_started_at,'-infinity'::timestamptz);
  select round(coalesce(sum(actual_puresafe_capital),0),2),round(coalesce(sum(actual_other_products_capital),0),2),round(coalesce(sum(actual_electricity_share),0),2),round(coalesce(sum(actual_contingency),0),2),round(coalesce(sum(credit_puresafe_capital),0),2),round(coalesce(sum(credit_other_products_capital),0),2),round(coalesce(sum(credit_electricity_share),0),2),round(coalesce(sum(credit_contingency),0),2),round(coalesce(sum(cleared_puresafe_credit),0),2),round(coalesce(sum(cleared_other_products_credit),0),2),round(coalesce(sum(cleared_electricity_credit),0),2),round(coalesce(sum(cleared_contingency_credit),0),2)
  into ap,ao,ae,ac,cp,co,ce,cc,xp,xo,xe,xc from public.cycle_set_aside_actuals where location_id=p_location_id and recorded_at between v_started and p_as_of;
  select round(coalesce(sum(sai.total_amount_paid) filter(where public.is_puresafe_one_litre_product(p.name,p.brand,p.variant,p.volume_text,p.unit)),0),2),round(coalesce(sum(sai.total_amount_paid) filter(where not public.is_puresafe_one_litre_product(p.name,p.brand,p.variant,p.volume_text,p.unit)),0),2)
  into up,uo from public.stock_addition_items sai join public.stock_additions sa on sa.id=sai.stock_addition_id join public.products p on p.id=sai.product_id where sa.location_id=p_location_id and sa.voided_at is null and sa.occurred_at between v_started and p_as_of;
  select round(coalesce(sum(amount) filter(where reserve_paid_from='PURESAFE'),0),2),round(coalesce(sum(amount) filter(where reserve_paid_from='OTHER_PRODUCTS'),0),2),round(coalesce(sum(amount) filter(where reserve_paid_from='ELECTRICITY'),0),2),round(coalesce(sum(amount) filter(where reserve_paid_from='CONTINGENCY'),0),2)
  into ep,eo,ee,ec from public.expenses where location_id=p_location_id and archived_at is null and affects_inventory_cost=false and reserve_paid_from is not null and incurred_on<=((p_as_of at time zone 'Asia/Manila')::date);
  -- Spending consumes physical reserve cash first and then reserve credit. This
  -- keeps both displayed balances nonnegative while preserving the same funded
  -- total and prevents a purchase from being deducted twice.
  pp:=greatest(round(coalesce(v_base.puresafe_balance,0)+ap+xp-up-ep,2),0); po:=greatest(round(coalesce(v_base.other_products_balance,0)+ao+xo-uo-eo,2),0); pe:=greatest(round(coalesce(v_base.electricity_balance,0)+ae+xe-ee,2),0); pc:=greatest(round(coalesce(v_base.contingency_balance,0)+ac+xc-ec,2),0);
  wp:=greatest(round(cp-xp-greatest(up+ep-(coalesce(v_base.puresafe_balance,0)+ap+xp),0),2),0);
  wo:=greatest(round(co- xo-greatest(uo+eo-(coalesce(v_base.other_products_balance,0)+ao+xo),0),2),0);
  we:=greatest(round(ce-xe-greatest(ee-(coalesce(v_base.electricity_balance,0)+ae+xe),0),2),0);
  wc:=greatest(round(cc-xc-greatest(ec-(coalesce(v_base.contingency_balance,0)+ac+xc),0),2),0);
  fp:=pp+wp; fo:=po+wo; fe:=pe+we; fc:=pc+wc;
  return jsonb_build_object('trackingStartedAt',nullif(v_started,'-infinity'::timestamptz),
    'puresafe',jsonb_build_object('goal',coalesce(v_settings.puresafe_reserve_goal,1300),'physicalBalance',pp,'creditAwaitingCash',wp,'fundedBalance',fp,'balance',fp,'remaining',greatest(coalesce(v_settings.puresafe_reserve_goal,1300)-fp,0),'goalMet',fp>=coalesce(v_settings.puresafe_reserve_goal,1300),'used',up+ep),
    'otherProducts',jsonb_build_object('goal',coalesce(v_settings.other_products_reserve_goal,600),'physicalBalance',po,'creditAwaitingCash',wo,'fundedBalance',fo,'balance',fo,'remaining',greatest(coalesce(v_settings.other_products_reserve_goal,600)-fo,0),'goalMet',fo>=coalesce(v_settings.other_products_reserve_goal,600),'used',uo+eo),
    'electricity',jsonb_build_object('goal',coalesce(v_settings.electricity_reserve_goal,2000),'physicalBalance',pe,'creditAwaitingCash',we,'fundedBalance',fe,'balance',fe,'remaining',greatest(coalesce(v_settings.electricity_reserve_goal,2000)-fe,0),'goalMet',fe>=coalesce(v_settings.electricity_reserve_goal,2000),'used',ee),
    'contingency',jsonb_build_object('physicalBalance',pc,'creditAwaitingCash',wc,'fundedBalance',fc,'balance',fc,'used',ec));
end;
$$;

do $migration$
begin
  if to_regprocedure('public.get_cycle_set_aside_before_payment_reserves(uuid)') is null then
    alter function public.get_cycle_set_aside(uuid) rename to get_cycle_set_aside_before_payment_reserves;
  end if;
end;
$migration$;

create or replace function public.get_cycle_set_aside(p_cycle_id uuid)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare v_cycle public.box_cycles%rowtype; v_actual public.cycle_set_aside_actuals%rowtype; v_detail jsonb; v_payments jsonb;
  gc numeric:=0; my numeric:=0; ub numeric:=0; bp numeric:=0; bk numeric:=0; ot numeric:=0; eligible numeric:=0; reserve_target numeric; physical numeric; recommended_credit numeric; online_stash numeric; cash_stash numeric;
begin
  select * into v_cycle from public.box_cycles where id=p_cycle_id; if not found then raise exception 'Cycle not found.'; end if;
  perform public.require_location_access(v_cycle.location_id,false);
  v_detail:=public.get_cycle_set_aside_before_payment_reserves(p_cycle_id); v_payments:=public.get_cycle_payment_detail(p_cycle_id);
  select round(coalesce(sum((p->>'amount')::numeric) filter(where p->>'method'='GCASH'),0),2),round(coalesce(sum((p->>'amount')::numeric) filter(where p->>'method'='MAYA'),0),2),round(coalesce(sum((p->>'amount')::numeric) filter(where p->>'method'='UNIONBANK'),0),2),round(coalesce(sum((p->>'amount')::numeric) filter(where p->>'method'='BPI'),0),2),round(coalesce(sum((p->>'amount')::numeric) filter(where p->>'method'='BANK'),0),2),round(coalesce(sum((p->>'amount')::numeric) filter(where p->>'method' not in ('GCASH','MAYA','UNIONBANK','BPI','BANK','CASH')),0),2)
  into gc,my,ub,bp,bk,ot from jsonb_array_elements(coalesce(v_payments->'records','[]'::jsonb)) p where p->>'channel'='online';
  eligible:=my+ub+bp+bk; reserve_target:=(v_detail->>'totalSetAside')::numeric; physical:=coalesce((v_detail->>'cashAvailableAfterChangeFloat')::numeric,0);
  recommended_credit:=case when reserve_target is null then null else least(eligible,greatest(reserve_target-physical,0)) end;
  cash_stash:=case when reserve_target is null then null else greatest(physical-reserve_target,0) end;
  online_stash:=case when reserve_target is null then null else gc+ot+greatest(eligible-coalesce(recommended_credit,0),0) end;
  select * into v_actual from public.cycle_set_aside_actuals where cycle_id=p_cycle_id;
  v_detail:=v_detail||jsonb_build_object('gcashPayments',gc,'mayaPayments',my,'unionbankPayments',ub,'bpiPayments',bp,'legacyBankPayments',bk,'otherOnlinePayments',ot,'eligibleOnlineReservePayments',eligible,'recommendedReserveCredit',recommended_credit,'onlineToStash',case when v_actual.id is null then online_stash else v_actual.online_to_stash end,'cashToStashTarget',cash_stash,'remainingEarnings',case when v_actual.id is null then case when cash_stash is null then null else cash_stash+online_stash end else (v_detail->>'remainingEarnings')::numeric end,'shortfall',case when reserve_target is null then null else greatest(reserve_target-physical-eligible,0) end,'puresafeReserveGoalSnapshot',v_cycle.puresafe_reserve_goal_snapshot,'otherProductsReserveGoalSnapshot',v_cycle.other_products_reserve_goal_snapshot,'electricityReserveGoalSnapshot',v_cycle.electricity_reserve_goal_snapshot);
  if v_actual.id is not null then
    v_detail:=jsonb_set(v_detail,'{actualSetAside}',(v_detail->'actualSetAside')||jsonb_build_object('creditPuresafeCapital',v_actual.credit_puresafe_capital,'creditOtherProductsCapital',v_actual.credit_other_products_capital,'creditElectricityShare',v_actual.credit_electricity_share,'creditContingency',v_actual.credit_contingency,'clearedPuresafeCredit',v_actual.cleared_puresafe_credit,'clearedOtherProductsCredit',v_actual.cleared_other_products_credit,'clearedElectricityCredit',v_actual.cleared_electricity_credit,'clearedContingencyCredit',v_actual.cleared_contingency_credit,'creditTotal',v_actual.credit_puresafe_capital+v_actual.credit_other_products_capital+v_actual.credit_electricity_share+v_actual.credit_contingency,'creditClearedTotal',v_actual.cleared_puresafe_credit+v_actual.cleared_other_products_credit+v_actual.cleared_electricity_credit+v_actual.cleared_contingency_credit,'fundedReserveTotal',v_actual.actual_puresafe_capital+v_actual.actual_other_products_capital+v_actual.actual_electricity_share+v_actual.actual_contingency+v_actual.credit_puresafe_capital+v_actual.credit_other_products_capital+v_actual.credit_electricity_share+v_actual.credit_contingency,'physicalCashTotal',v_actual.actual_puresafe_capital+v_actual.actual_other_products_capital+v_actual.actual_electricity_share+v_actual.actual_contingency+v_actual.cleared_puresafe_credit+v_actual.cleared_other_products_credit+v_actual.cleared_electricity_credit+v_actual.cleared_contingency_credit+v_actual.actual_to_stash_cash,'toStashTotal',v_actual.actual_to_stash_cash+v_actual.online_to_stash));
  end if;
  return v_detail;
end;
$$;

create or replace function public.save_cycle_set_aside_actual(
  p_cycle_id uuid,p_actual_puresafe_capital text,p_actual_other_products_capital text,p_actual_electricity_share text,p_actual_contingency text,
  p_credit_puresafe_capital text,p_credit_other_products_capital text,p_credit_electricity_share text,p_credit_contingency text,
  p_cleared_puresafe_credit text,p_cleared_other_products_credit text,p_cleared_electricity_credit text,p_cleared_contingency_credit text,
  p_actual_to_stash_cash text,p_note text default null
) returns jsonb language plpgsql security definer set search_path=public as $$
declare v_user uuid:=auth.uid(); v_cycle public.box_cycles%rowtype; v_old public.cycle_set_aside_actuals%rowtype; d jsonb; funds jsonb; actual_online_stash numeric;
  ap numeric:=round(coalesce(nullif(btrim(coalesce(p_actual_puresafe_capital,'')),'')::numeric,0),2); ao numeric:=round(coalesce(nullif(btrim(coalesce(p_actual_other_products_capital,'')),'')::numeric,0),2); ae numeric:=round(coalesce(nullif(btrim(coalesce(p_actual_electricity_share,'')),'')::numeric,0),2); ac numeric:=round(coalesce(nullif(btrim(coalesce(p_actual_contingency,'')),'')::numeric,0),2);
  cp numeric:=round(coalesce(nullif(btrim(coalesce(p_credit_puresafe_capital,'')),'')::numeric,0),2); co numeric:=round(coalesce(nullif(btrim(coalesce(p_credit_other_products_capital,'')),'')::numeric,0),2); ce numeric:=round(coalesce(nullif(btrim(coalesce(p_credit_electricity_share,'')),'')::numeric,0),2); cc numeric:=round(coalesce(nullif(btrim(coalesce(p_credit_contingency,'')),'')::numeric,0),2);
  xp numeric:=round(coalesce(nullif(btrim(coalesce(p_cleared_puresafe_credit,'')),'')::numeric,0),2); xo numeric:=round(coalesce(nullif(btrim(coalesce(p_cleared_other_products_credit,'')),'')::numeric,0),2); xe numeric:=round(coalesce(nullif(btrim(coalesce(p_cleared_electricity_credit,'')),'')::numeric,0),2); xc numeric:=round(coalesce(nullif(btrim(coalesce(p_cleared_contingency_credit,'')),'')::numeric,0),2); stash numeric:=round(coalesce(nullif(btrim(coalesce(p_actual_to_stash_cash,'')),'')::numeric,0),2);
begin
  if v_user is null then raise exception 'Authentication required.'; end if;
  select * into v_cycle from public.box_cycles where id=p_cycle_id for update; if not found then raise exception 'Cycle not found.'; end if;
  perform public.require_location_access(v_cycle.location_id,false);
  if v_cycle.status<>'COMPLETED' then raise exception 'Actual set aside can only be recorded for a completed cycle.'; end if;
  if least(ap,ao,ae,ac,cp,co,ce,cc,xp,xo,xe,xc,stash)<0 then raise exception 'Actual and credit amounts cannot be negative.'; end if;
  d:=public.get_cycle_set_aside(p_cycle_id); funds:=public.get_set_aside_fund_balances(v_cycle.location_id,now());
  select * into v_old from public.cycle_set_aside_actuals where cycle_id=p_cycle_id;
  if ap+ao+ae+ac+xp+xo+xe+xc+stash>(d->>'cashAvailableAfterChangeFloat')::numeric then raise exception 'Physical allocations cannot exceed cash available after Change Float.'; end if;
  if cp+co+ce+cc>coalesce((d->>'eligibleOnlineReservePayments')::numeric,0) then raise exception 'Reserve credit cannot exceed eligible Maya, UnionBank, BPI, and legacy bank payments.'; end if;
  if xp>coalesce((funds#>>'{puresafe,creditAwaitingCash}')::numeric,0)-coalesce(v_old.credit_puresafe_capital,0)+coalesce(v_old.cleared_puresafe_credit,0)+cp or xo>coalesce((funds#>>'{otherProducts,creditAwaitingCash}')::numeric,0)-coalesce(v_old.credit_other_products_capital,0)+coalesce(v_old.cleared_other_products_credit,0)+co or xe>coalesce((funds#>>'{electricity,creditAwaitingCash}')::numeric,0)-coalesce(v_old.credit_electricity_share,0)+coalesce(v_old.cleared_electricity_credit,0)+ce or xc>coalesce((funds#>>'{contingency,creditAwaitingCash}')::numeric,0)-coalesce(v_old.credit_contingency,0)+coalesce(v_old.cleared_contingency_credit,0)+cc then raise exception 'Cash retained to clear credit exceeds outstanding reserve credit.'; end if;
  actual_online_stash:=round(coalesce((d->>'gcashPayments')::numeric,0)+coalesce((d->>'otherOnlinePayments')::numeric,0)+greatest(coalesce((d->>'eligibleOnlineReservePayments')::numeric,0)-cp-co-ce-cc,0),2);
  insert into public.cycle_set_aside_actuals(location_id,cycle_id,target_puresafe_capital,target_other_products_capital,target_electricity_share,target_contingency,target_to_stash,target_cash_shortfall,online_to_stash,actual_puresafe_capital,actual_other_products_capital,actual_electricity_share,actual_contingency,credit_puresafe_capital,credit_other_products_capital,credit_electricity_share,credit_contingency,cleared_puresafe_credit,cleared_other_products_credit,cleared_electricity_credit,cleared_contingency_credit,actual_to_stash_cash,note,recorded_by,updated_by)
  values(v_cycle.location_id,v_cycle.id,(d->>'puresafeCapital')::numeric,(d->>'miscCapital')::numeric,(d->>'electricityShare')::numeric,coalesce((d->>'contingencyCapital')::numeric,0),(d->>'remainingEarnings')::numeric,(d->>'shortfall')::numeric,actual_online_stash,ap,ao,ae,ac,cp,co,ce,cc,xp,xo,xe,xc,stash,nullif(btrim(coalesce(p_note,'')),''),v_user,v_user)
  on conflict(cycle_id) do update set online_to_stash=excluded.online_to_stash,actual_puresafe_capital=excluded.actual_puresafe_capital,actual_other_products_capital=excluded.actual_other_products_capital,actual_electricity_share=excluded.actual_electricity_share,actual_contingency=excluded.actual_contingency,credit_puresafe_capital=excluded.credit_puresafe_capital,credit_other_products_capital=excluded.credit_other_products_capital,credit_electricity_share=excluded.credit_electricity_share,credit_contingency=excluded.credit_contingency,cleared_puresafe_credit=excluded.cleared_puresafe_credit,cleared_other_products_credit=excluded.cleared_other_products_credit,cleared_electricity_credit=excluded.cleared_electricity_credit,cleared_contingency_credit=excluded.cleared_contingency_credit,actual_to_stash_cash=excluded.actual_to_stash_cash,note=excluded.note,updated_by=v_user,updated_at=now();
  return public.get_cycle_set_aside(p_cycle_id);
end;
$$;

create or replace function public.record_reserve_goal_hits_for_cycle(p_cycle_id uuid)
returns void language plpgsql security definer set search_path=public as $$
declare c public.box_cycles%rowtype; f jsonb; kind text; goal numeric; funded numeric; last_hit timestamptz; last_spend timestamptz;
begin
  select * into c from public.box_cycles where id=p_cycle_id; if not found then return; end if;
  f:=public.get_set_aside_fund_balances(c.location_id,now());
  foreach kind in array array['PURESAFE','OTHER_PRODUCTS','ELECTRICITY'] loop
    goal:=case kind when 'PURESAFE' then (f#>>'{puresafe,goal}')::numeric when 'OTHER_PRODUCTS' then (f#>>'{otherProducts,goal}')::numeric else (f#>>'{electricity,goal}')::numeric end;
    funded:=case kind when 'PURESAFE' then (f#>>'{puresafe,fundedBalance}')::numeric when 'OTHER_PRODUCTS' then (f#>>'{otherProducts,fundedBalance}')::numeric else (f#>>'{electricity,fundedBalance}')::numeric end;
    select max(hit_at) into last_hit from public.reserve_goal_hits where location_id=c.location_id and reserve_kind=kind;
    select max(spent_at) into last_spend from (
      select sa.occurred_at spent_at from public.stock_addition_items sai join public.stock_additions sa on sa.id=sai.stock_addition_id join public.products p on p.id=sai.product_id where sa.location_id=c.location_id and sa.voided_at is null and ((kind='PURESAFE' and public.is_puresafe_one_litre_product(p.name,p.brand,p.variant,p.volume_text,p.unit)) or (kind='OTHER_PRODUCTS' and not public.is_puresafe_one_litre_product(p.name,p.brand,p.variant,p.volume_text,p.unit)))
      union all select incurred_on::timestamp at time zone 'Asia/Manila' from public.expenses where location_id=c.location_id and archived_at is null and affects_inventory_cost=false and reserve_paid_from=kind
    ) spent;
    if goal>0 and funded>=goal and (last_hit is null or (last_spend is not null and last_spend>last_hit)) then insert into public.reserve_goal_hits(location_id,cycle_id,reserve_kind,goal_amount,funded_balance) values(c.location_id,c.id,kind,goal,funded) on conflict(cycle_id,reserve_kind) do nothing; end if;
  end loop;
end;
$$;

create or replace function public.capture_reserve_goal_hits()
returns trigger language plpgsql security definer set search_path=public as $$ begin perform public.record_reserve_goal_hits_for_cycle(new.cycle_id); return new; end; $$;
drop trigger if exists capture_reserve_goal_hits on public.cycle_set_aside_actuals;
create trigger capture_reserve_goal_hits after insert or update on public.cycle_set_aside_actuals for each row execute function public.capture_reserve_goal_hits();

-- Unassigned receipts reduce only the overall gap. A later assignment either
-- links their unallocated remainder to one cycle or allocates it to a balance.
create or replace function public.list_unassigned_payment_receipts()
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare loc uuid:=public.require_current_location_id();
begin
  perform public.require_location_access(loc,false);
  return (select coalesce(jsonb_agg(jsonb_build_object('id',pr.id,'amount',pr.amount,'method',pr.method,'paymentTiming',pr.payment_timing,'receivedAt',pr.received_at,'note',pr.note,'relatedCycleId',pr.related_cycle_id,'unallocatedAmount',greatest(pr.amount-coalesce(a.allocated,0),0)) order by pr.received_at desc),'[]'::jsonb) from public.payment_receipts pr left join lateral(select sum(amount) allocated from public.payment_allocations where payment_receipt_id=pr.id) a on true where pr.location_id=loc and pr.related_cycle_id is null and greatest(pr.amount-coalesce(a.allocated,0),0)>0);
end;
$$;

create or replace function public.list_payment_assignment_cycles()
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare loc uuid:=public.require_current_location_id();
begin
  perform public.require_location_access(loc,false);
  return (select coalesce(jsonb_agg(jsonb_build_object('cycleId',bc.id,'cycleNumber',bc.cycle_number,'completedAt',bc.completed_at,'expectedRevenue',coalesce(bc.expected_revenue,0),'payments',coalesce((d#>>'{summary,totalPayments}')::numeric,0),'gap',greatest(coalesce(bc.expected_revenue,0)-coalesce((d#>>'{summary,totalPayments}')::numeric,0),0)) order by bc.completed_at desc),'[]'::jsonb) from public.box_cycles bc cross join lateral(select public.get_cycle_payment_detail(bc.id) d) x where bc.location_id=loc and bc.status='COMPLETED');
end;
$$;

create or replace function public.assign_payment_receipt(p_receipt_id uuid,p_cycle_id uuid default null,p_pay_later_balance_id uuid default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare loc uuid:=public.require_current_location_id(); r public.payment_receipts%rowtype; b public.pay_later_balances%rowtype; available numeric;
begin
  perform public.require_location_access(loc,false);
  select * into r from public.payment_receipts where id=p_receipt_id and location_id=loc for update; if not found then raise exception 'Payment receipt not found.'; end if;
  available:=r.amount-coalesce((select sum(amount) from public.payment_allocations where payment_receipt_id=r.id),0);
  if available<=0 or r.related_cycle_id is not null then raise exception 'This payment is already fully assigned.'; end if;
  if p_pay_later_balance_id is not null then
    select * into b from public.pay_later_balances where id=p_pay_later_balance_id and location_id=loc for update; if not found then raise exception 'Pay-later balance not found.'; end if;
    insert into public.payment_allocations(payment_receipt_id,pay_later_balance_id,amount) values(r.id,b.id,least(available,b.remaining_amount));
    perform public.refresh_pay_later_balance(b.id); perform public.sync_cycle_financials(b.source_cycle_id);
  elsif p_cycle_id is not null then
    if not exists(select 1 from public.box_cycles where id=p_cycle_id and location_id=loc) then raise exception 'Cycle not found.'; end if;
    update public.payment_receipts set related_cycle_id=p_cycle_id,payment_timing='DELAYED' where id=r.id;
    perform public.sync_cycle_financials(p_cycle_id);
  else raise exception 'Choose a cycle or pay-later balance.'; end if;
  return jsonb_build_object('id',r.id,'assigned',true);
end;
$$;

do $migration$
begin
  if to_regprocedure('public.get_report_payment_detail_before_unassigned(text,date,date)') is null then alter function public.get_report_payment_detail(text,date,date) rename to get_report_payment_detail_before_unassigned; end if;
end;
$migration$;

create or replace function public.get_report_payment_detail(p_range_key text default '30d',p_start_date date default null,p_end_date date default null)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare loc uuid:=public.get_current_location_id(); base jsonb; sd date; ed date:=coalesce(p_end_date,current_date); unassigned jsonb; ucash numeric:=0; uonline numeric:=0;
begin
  base:=public.get_report_payment_detail_before_unassigned(p_range_key,p_start_date,p_end_date); if loc is null then return base; end if;
  sd:=coalesce(p_start_date,case coalesce(p_range_key,'30d') when '7d' then current_date-6 when '30d' then current_date-29 when 'month' then date_trunc('month',current_date)::date when '3m' then (date_trunc('month',current_date)-interval '2 month')::date when '6m' then (date_trunc('month',current_date)-interval '5 month')::date when '1y' then (date_trunc('month',current_date)-interval '11 month')::date else current_date-29 end);
  with u as (select pr.*,greatest(pr.amount-coalesce((select sum(amount) from public.payment_allocations where payment_receipt_id=pr.id),0),0) remaining from public.payment_receipts pr where pr.location_id=loc and pr.related_cycle_id is null and pr.received_at::date between sd and ed)
  select coalesce(jsonb_agg(jsonb_build_object('id','unassigned-'||id,'cycleId',null,'cycleLabel','Unassigned','occurredAt',received_at,'recordedAt',created_at,'amount',remaining,'method',method,'channel',case when method='CASH' then 'cash' else 'online' end,'source','unassigned_receipt','note',note,'isItemized',true) order by received_at desc) filter(where remaining>0),'[]'::jsonb),round(coalesce(sum(remaining) filter(where method='CASH'),0),2),round(coalesce(sum(remaining) filter(where method<>'CASH'),0),2) into unassigned,ucash,uonline from u;
  return base||jsonb_build_object('summary',(base->'summary')||jsonb_build_object('assignedPayments',coalesce((base#>>'{summary,totalPayments}')::numeric,0),'unassignedPayments',ucash+uonline,'cashPayments',coalesce((base#>>'{summary,cashPayments}')::numeric,0)+ucash,'onlinePayments',coalesce((base#>>'{summary,onlinePayments}')::numeric,0)+uonline,'totalPayments',coalesce((base#>>'{summary,totalPayments}')::numeric,0)+ucash+uonline),'records',coalesce(base->'records','[]'::jsonb)||unassigned);
end;
$$;

do $migration$
begin
  if to_regprocedure('public.get_report_set_aside_before_goal_hits(text,date,date)') is null then alter function public.get_report_set_aside(text,date,date) rename to get_report_set_aside_before_goal_hits; end if;
end;
$migration$;

create or replace function public.get_report_set_aside(p_range_key text default '30d',p_start_date date default null,p_end_date date default null)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare loc uuid:=public.get_current_location_id(); r jsonb; sd date; ed date:=coalesce(p_end_date,current_date); hits jsonb; funding jsonb; opening_funds jsonb; closing_funds jsonb;
begin
  r:=public.get_report_set_aside_before_goal_hits(p_range_key,p_start_date,p_end_date); if loc is null then return r; end if;
  sd:=coalesce(p_start_date,case coalesce(p_range_key,'30d') when '7d' then current_date-6 when '30d' then current_date-29 when 'month' then date_trunc('month',current_date)::date when '3m' then (date_trunc('month',current_date)-interval '2 month')::date when '6m' then (date_trunc('month',current_date)-interval '5 month')::date when '1y' then (date_trunc('month',current_date)-interval '11 month')::date else current_date-29 end);
  opening_funds:=public.get_set_aside_fund_balances(loc,(sd::timestamp at time zone 'Asia/Manila')-interval '1 microsecond');
  closing_funds:=public.get_set_aside_fund_balances(loc,((ed+1)::timestamp at time zone 'Asia/Manila')-interval '1 microsecond');
  select jsonb_build_object('puresafe',jsonb_build_object('count',count(*) filter(where reserve_kind='PURESAFE'),'dates',coalesce(jsonb_agg(hit_at order by hit_at) filter(where reserve_kind='PURESAFE'),'[]'::jsonb)),'otherProducts',jsonb_build_object('count',count(*) filter(where reserve_kind='OTHER_PRODUCTS'),'dates',coalesce(jsonb_agg(hit_at order by hit_at) filter(where reserve_kind='OTHER_PRODUCTS'),'[]'::jsonb)),'electricity',jsonb_build_object('count',count(*) filter(where reserve_kind='ELECTRICITY'),'dates',coalesce(jsonb_agg(hit_at order by hit_at) filter(where reserve_kind='ELECTRICITY'),'[]'::jsonb))) into hits from public.reserve_goal_hits where location_id=loc and hit_at::date between sd and ed;
  select jsonb_build_object(
    'actualCreditPuresafeCapital',case when count(*) filter(where cycle->'actualSetAside' is not null and cycle->'actualSetAside'<>'null'::jsonb)=0 then null else round(coalesce(sum((cycle#>>'{actualSetAside,creditPuresafeCapital}')::numeric),0),2) end,
    'actualCreditOtherProductsCapital',case when count(*) filter(where cycle->'actualSetAside' is not null and cycle->'actualSetAside'<>'null'::jsonb)=0 then null else round(coalesce(sum((cycle#>>'{actualSetAside,creditOtherProductsCapital}')::numeric),0),2) end,
    'actualCreditElectricityShare',case when count(*) filter(where cycle->'actualSetAside' is not null and cycle->'actualSetAside'<>'null'::jsonb)=0 then null else round(coalesce(sum((cycle#>>'{actualSetAside,creditElectricityShare}')::numeric),0),2) end,
    'actualCreditContingency',case when count(*) filter(where cycle->'actualSetAside' is not null and cycle->'actualSetAside'<>'null'::jsonb)=0 then null else round(coalesce(sum((cycle#>>'{actualSetAside,creditContingency}')::numeric),0),2) end,
    'actualCreditTotal',case when count(*) filter(where cycle->'actualSetAside' is not null and cycle->'actualSetAside'<>'null'::jsonb)=0 then null else round(coalesce(sum((cycle#>>'{actualSetAside,creditTotal}')::numeric),0),2) end,
    'actualFundedReserveTotal',case when count(*) filter(where cycle->'actualSetAside' is not null and cycle->'actualSetAside'<>'null'::jsonb)=0 then null else round(coalesce(sum((cycle#>>'{actualSetAside,fundedReserveTotal}')::numeric),0),2) end,
    'onlineToStash',round(coalesce(sum((cycle->>'onlineToStash')::numeric),0),2),
    'gcashToStash',round(coalesce(sum((cycle->>'gcashPayments')::numeric),0),2),
    'mayaPayments',round(coalesce(sum((cycle->>'mayaPayments')::numeric),0),2),
    'unionbankPayments',round(coalesce(sum((cycle->>'unionbankPayments')::numeric),0),2),
    'bpiPayments',round(coalesce(sum((cycle->>'bpiPayments')::numeric),0),2),
    'legacyBankPayments',round(coalesce(sum((cycle->>'legacyBankPayments')::numeric),0),2),
    'otherOnlineToStash',round(coalesce(sum((cycle->>'otherOnlinePayments')::numeric),0),2)
  ) into funding from jsonb_array_elements(coalesce(r->'cycles','[]'::jsonb)) cycle;
  funding:=coalesce(funding,'{}'::jsonb)||jsonb_build_object(
    'netOtherProductsSetAside',case when (r#>>'{summary,actualOtherProductsCapital}') is null then null else round(coalesce((r#>>'{summary,actualOtherProductsCapital}')::numeric,0)+coalesce((funding->>'actualCreditOtherProductsCapital')::numeric,0)-coalesce((r#>>'{summary,usedForOtherProductRestocks}')::numeric,0),2) end,
    'openingOtherProductsReserve',(opening_funds#>>'{otherProducts,fundedBalance}')::numeric,
    'closingOtherProductsReserve',(closing_funds#>>'{otherProducts,fundedBalance}')::numeric
  );
  return r||jsonb_build_object('summary',(r->'summary')||coalesce(funding,'{}'::jsonb)||jsonb_build_object('goalHits',hits,'openingFundBalances',opening_funds,'closingFundBalances',closing_funds,'fundBalances',closing_funds));
end;
$$;

revoke all on function public.get_cycle_payment_detail_before_channels(uuid) from public,anon,authenticated;
revoke all on function public.get_cycle_detail_before_channels(uuid) from public,anon,authenticated;
revoke all on function public.get_cycle_set_aside_before_payment_reserves(uuid) from public,anon,authenticated;
revoke all on function public.get_report_payment_detail_before_unassigned(text,date,date) from public,anon,authenticated;
revoke all on function public.get_report_set_aside_before_goal_hits(text,date,date) from public,anon,authenticated;
grant execute on function public.get_cycle_payment_detail(uuid) to authenticated;
grant execute on function public.get_cycle_detail(uuid) to authenticated;
grant execute on function public.preview_box_check_with_float(text,text,text,text,text,text,jsonb,jsonb,text,text) to authenticated;
grant execute on function public.complete_box_check_with_float(text,text,text,text,text,text,jsonb,jsonb,jsonb,text,text,text,uuid) to authenticated;
grant execute on function public.correct_completed_box_cycle(uuid,text,text,text,text,text,text,jsonb,text) to authenticated;
grant execute on function public.update_set_aside_settings(numeric,text,numeric,numeric,numeric,numeric,numeric) to authenticated;
grant execute on function public.save_expense(uuid,uuid,date,text,text,text,text) to authenticated;
grant execute on function public.get_set_aside_fund_balances(uuid,timestamptz) to authenticated;
grant execute on function public.get_cycle_set_aside(uuid) to authenticated;
grant execute on function public.save_cycle_set_aside_actual(uuid,text,text,text,text,text,text,text,text,text,text,text,text,text,text) to authenticated;
grant execute on function public.list_unassigned_payment_receipts() to authenticated;
grant execute on function public.list_payment_assignment_cycles() to authenticated;
grant execute on function public.assign_payment_receipt(uuid,uuid,uuid) to authenticated;
grant execute on function public.get_report_payment_detail(text,date,date) to authenticated;
grant execute on function public.get_report_set_aside(text,date,date) to authenticated;

notify pgrst,'reload schema';
commit;
