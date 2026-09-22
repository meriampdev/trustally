-- Actual physical set-aside records and an automatically derived Other Products
-- reserve. Existing calculated targets, Change Float, cash-shortfall, Stash,
-- inventory, and expense behavior remain unchanged.

begin;

create table if not exists public.cycle_set_aside_actuals (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references public.locations(id) on delete cascade,
  cycle_id uuid not null unique references public.box_cycles(id) on delete cascade,
  target_puresafe_capital numeric(12,2),
  target_other_products_capital numeric(12,2),
  target_electricity_share numeric(12,2) not null,
  target_to_stash numeric(12,2),
  target_cash_shortfall numeric(12,2),
  online_to_stash numeric(12,2) not null default 0,
  actual_puresafe_capital numeric(12,2) not null default 0,
  actual_other_products_capital numeric(12,2) not null default 0,
  actual_electricity_share numeric(12,2) not null default 0,
  actual_to_stash_cash numeric(12,2) not null default 0,
  note text,
  recorded_by uuid not null references auth.users(id) on delete restrict,
  recorded_at timestamptz not null default now(),
  updated_by uuid not null references auth.users(id) on delete restrict,
  updated_at timestamptz not null default now(),
  constraint cycle_set_aside_actuals_targets_nonnegative check (
    (target_puresafe_capital is null or target_puresafe_capital >= 0)
    and (target_other_products_capital is null or target_other_products_capital >= 0)
    and target_electricity_share >= 0
    and (target_to_stash is null or target_to_stash >= 0)
    and (target_cash_shortfall is null or target_cash_shortfall >= 0)
    and online_to_stash >= 0
  ),
  constraint cycle_set_aside_actuals_actuals_nonnegative check (
    actual_puresafe_capital >= 0
    and actual_other_products_capital >= 0
    and actual_electricity_share >= 0
    and actual_to_stash_cash >= 0
  )
);

create index if not exists cycle_set_aside_actuals_location_cycle_idx
  on public.cycle_set_aside_actuals(location_id, cycle_id);

alter table public.cycle_set_aside_actuals enable row level security;
revoke all on public.cycle_set_aside_actuals from public, anon, authenticated;

create or replace function public.is_puresafe_one_litre_product(
  p_name text,
  p_brand text,
  p_variant text,
  p_volume_text text,
  p_unit text
)
returns boolean
language sql
immutable
set search_path = public
as $$
  select lower(concat_ws(' ', p_brand, p_name)) like '%puresafe%'
    and (
      regexp_replace(lower(coalesce(p_volume_text, '')), '\s', '', 'g') in ('1l', '1000ml')
      or lower(public.format_product_name(p_name, p_brand, p_variant, p_volume_text, p_unit)) ~ '(^|[^0-9])1\s*l([^a-z]|$)'
    );
$$;

do $migration$
begin
  if to_regprocedure('public.get_cycle_set_aside_calculated(uuid)') is null then
    alter function public.get_cycle_set_aside(uuid) rename to get_cycle_set_aside_calculated;
  end if;
  if to_regprocedure('public.get_report_set_aside_calculated(text,date,date)') is null then
    alter function public.get_report_set_aside(text,date,date) rename to get_report_set_aside_calculated;
  end if;
end;
$migration$;

create or replace function public.get_other_products_reserve_balance(
  p_location_id uuid,
  p_as_of timestamptz
)
returns numeric
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_tracking_started_at timestamptz;
  v_deposits numeric(14,2);
  v_used numeric(14,2);
begin
  select min(bc.completed_at)
  into v_tracking_started_at
  from public.cycle_set_aside_actuals actual
  join public.box_cycles bc on bc.id = actual.cycle_id
  where actual.location_id = p_location_id;

  if v_tracking_started_at is null or p_as_of < v_tracking_started_at then return null; end if;

  select coalesce(sum(actual.actual_other_products_capital), 0)
  into v_deposits
  from public.cycle_set_aside_actuals actual
  join public.box_cycles bc on bc.id = actual.cycle_id
  where actual.location_id = p_location_id
    and bc.completed_at <= p_as_of;

  select coalesce(sum(sai.total_amount_paid), 0)
  into v_used
  from public.stock_addition_items sai
  join public.stock_additions sa on sa.id = sai.stock_addition_id
  join public.products p on p.id = sai.product_id
  where sa.location_id = p_location_id
    and sa.voided_at is null
    and sa.occurred_at >= v_tracking_started_at
    and sa.occurred_at <= p_as_of
    and not public.is_puresafe_one_litre_product(p.name,p.brand,p.variant,p.volume_text,p.unit);

  return round(v_deposits - v_used, 2);
end;
$$;

create or replace function public.get_cycle_set_aside(p_cycle_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_cycle public.box_cycles%rowtype;
  v_actual public.cycle_set_aside_actuals%rowtype;
  v_detail jsonb;
  v_tracking_started_at timestamptz;
  v_used numeric(14,2) := 0;
  v_opening numeric(14,2);
  v_closing numeric(14,2);
  v_actual_json jsonb := null;
  v_payment_detail jsonb;
  v_gcash numeric(14,2) := 0;
  v_maya numeric(14,2) := 0;
  v_other_online numeric(14,2) := 0;
begin
  select * into v_cycle from public.box_cycles where id=p_cycle_id;
  if not found then raise exception 'Cycle not found.'; end if;
  perform public.require_location_access(v_cycle.location_id,false);
  v_detail:=public.get_cycle_set_aside_calculated(p_cycle_id);
  v_payment_detail:=public.get_cycle_payment_detail(p_cycle_id);
  select
    round(coalesce(sum((payment->>'amount')::numeric) filter (where payment->>'method'='GCASH'),0),2),
    round(coalesce(sum((payment->>'amount')::numeric) filter (where payment->>'method'='MAYA'),0),2),
    round(coalesce(sum((payment->>'amount')::numeric) filter (where payment->>'method' not in ('GCASH','MAYA')),0),2)
  into v_gcash,v_maya,v_other_online
  from jsonb_array_elements(coalesce(v_payment_detail->'records','[]'::jsonb)) payment
  where payment->>'channel'='online';
  v_detail:=v_detail || jsonb_build_object(
    'gcashPayments',v_gcash,
    'mayaPayments',v_maya,
    'otherOnlinePayments',v_other_online,
    'availableOnlinePayments',round(v_gcash+v_maya+v_other_online,2)
  );

  select * into v_actual from public.cycle_set_aside_actuals where cycle_id=p_cycle_id;
  if found then
    v_detail:=v_detail || jsonb_build_object(
      'puresafeCapital',v_actual.target_puresafe_capital,
      'miscCapital',v_actual.target_other_products_capital,
      'electricityShare',v_actual.target_electricity_share,
      'totalSetAside',case when v_actual.target_puresafe_capital is null or v_actual.target_other_products_capital is null then null
        else round(v_actual.target_puresafe_capital+v_actual.target_other_products_capital+v_actual.target_electricity_share,2) end,
      'remainingEarnings',v_actual.target_to_stash,
      'shortfall',v_actual.target_cash_shortfall
    );
    v_actual_json:=jsonb_build_object(
      'id',v_actual.id,'puresafeCapital',v_actual.actual_puresafe_capital,
      'otherProductsCapital',v_actual.actual_other_products_capital,
      'electricityShare',v_actual.actual_electricity_share,
      'toStashCash',v_actual.actual_to_stash_cash,'onlineToStash',v_actual.online_to_stash,
      'toStashTotal',round(v_actual.actual_to_stash_cash+v_actual.online_to_stash,2),
      'physicalCashTotal',round(v_actual.actual_puresafe_capital+v_actual.actual_other_products_capital+v_actual.actual_electricity_share+v_actual.actual_to_stash_cash,2),
      'note',v_actual.note,'recordedAt',v_actual.recorded_at,'updatedAt',v_actual.updated_at
    );
  end if;

  select min(bc.completed_at) into v_tracking_started_at
  from public.cycle_set_aside_actuals actual join public.box_cycles bc on bc.id=actual.cycle_id
  where actual.location_id=v_cycle.location_id;

  if v_tracking_started_at is not null and v_cycle.completed_at is not null and v_cycle.completed_at>=v_tracking_started_at then
    v_opening:=case when v_cycle.started_at<=v_tracking_started_at then 0
      else public.get_other_products_reserve_balance(v_cycle.location_id,v_cycle.started_at-interval '1 microsecond') end;
    v_closing:=public.get_other_products_reserve_balance(v_cycle.location_id,v_cycle.completed_at);
    select coalesce(sum(sai.total_amount_paid),0) into v_used
    from public.stock_addition_items sai join public.stock_additions sa on sa.id=sai.stock_addition_id
    join public.products p on p.id=sai.product_id
    where sa.location_id=v_cycle.location_id and sa.cycle_id=v_cycle.id and sa.voided_at is null
      and sa.occurred_at>=v_tracking_started_at and sa.occurred_at<=v_cycle.completed_at
      and not public.is_puresafe_one_litre_product(p.name,p.brand,p.variant,p.volume_text,p.unit);
  end if;

  return v_detail || jsonb_build_object(
    'actualSetAside',v_actual_json,
    'otherProductsReserve',jsonb_build_object(
      'trackingStartedAt',v_tracking_started_at,'actualSetAside',case when v_actual.id is null then null else v_actual.actual_other_products_capital end,
      'usedForRestocks',case when v_tracking_started_at is null then null else round(v_used,2) end,
      'netSetAside',case when v_actual.id is null then null else round(v_actual.actual_other_products_capital-v_used,2) end,
      'openingBalance',v_opening,'closingBalance',v_closing
    )
  );
end;
$$;

create or replace function public.save_cycle_set_aside_actual(
  p_cycle_id uuid,
  p_actual_puresafe_capital text,
  p_actual_other_products_capital text,
  p_actual_electricity_share text,
  p_actual_to_stash_cash text,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid:=auth.uid();
  v_cycle public.box_cycles%rowtype;
  v_detail jsonb;
  v_previous jsonb;
  v_puresafe numeric(12,2):=round(coalesce(nullif(btrim(coalesce(p_actual_puresafe_capital,'')),'')::numeric,0),2);
  v_other numeric(12,2):=round(coalesce(nullif(btrim(coalesce(p_actual_other_products_capital,'')),'')::numeric,0),2);
  v_electricity numeric(12,2):=round(coalesce(nullif(btrim(coalesce(p_actual_electricity_share,'')),'')::numeric,0),2);
  v_stash_cash numeric(12,2):=round(coalesce(nullif(btrim(coalesce(p_actual_to_stash_cash,'')),'')::numeric,0),2);
  v_target_total numeric(12,2);
  v_target_stash numeric(12,2);
begin
  if v_user is null then raise exception 'Authentication required.'; end if;
  select * into v_cycle from public.box_cycles where id=p_cycle_id for update;
  if not found then raise exception 'Cycle not found.'; end if;
  perform public.require_location_access(v_cycle.location_id,false);
  if v_cycle.status<>'COMPLETED' or v_cycle.completed_at is null then raise exception 'Actual set aside can only be recorded for a completed cycle.'; end if;
  if least(v_puresafe,v_other,v_electricity,v_stash_cash)<0 then raise exception 'Actual amounts cannot be negative.'; end if;

  v_detail:=public.get_cycle_set_aside_calculated(p_cycle_id);
  if v_puresafe+v_other+v_electricity+v_stash_cash>(v_detail->>'cashAvailableAfterChangeFloat')::numeric then
    raise exception 'Actual set aside cannot exceed the physical cash available after Change Float.';
  end if;
  v_target_total:=case when v_detail->>'puresafeCapital' is null or v_detail->>'miscCapital' is null then null
    else round((v_detail->>'puresafeCapital')::numeric+(v_detail->>'miscCapital')::numeric+(v_detail->>'electricityShare')::numeric,2) end;
  v_target_stash:=case when v_target_total is null then null else round((v_detail->>'availableOnlinePayments')::numeric+
    greatest((v_detail->>'cashAvailableAfterChangeFloat')::numeric-v_target_total,0),2) end;
  select to_jsonb(actual) into v_previous from public.cycle_set_aside_actuals actual where cycle_id=p_cycle_id;

  insert into public.cycle_set_aside_actuals(location_id,cycle_id,target_puresafe_capital,target_other_products_capital,target_electricity_share,
    target_to_stash,target_cash_shortfall,online_to_stash,actual_puresafe_capital,actual_other_products_capital,
    actual_electricity_share,actual_to_stash_cash,note,recorded_by,updated_by)
  values(v_cycle.location_id,v_cycle.id,(v_detail->>'puresafeCapital')::numeric,(v_detail->>'miscCapital')::numeric,
    (v_detail->>'electricityShare')::numeric,v_target_stash,
    case when v_target_total is null then null else greatest(v_target_total-(v_detail->>'cashAvailableAfterChangeFloat')::numeric,0) end,
    (v_detail->>'availableOnlinePayments')::numeric,v_puresafe,v_other,v_electricity,v_stash_cash,
    nullif(btrim(coalesce(p_note,'')),''),v_user,v_user)
  on conflict(cycle_id) do update set
    online_to_stash=excluded.online_to_stash,
    actual_puresafe_capital=excluded.actual_puresafe_capital,
    actual_other_products_capital=excluded.actual_other_products_capital,
    actual_electricity_share=excluded.actual_electricity_share,
    actual_to_stash_cash=excluded.actual_to_stash_cash,note=excluded.note,updated_by=v_user,updated_at=now();

  perform public.record_audit_log(v_cycle.location_id,case when v_previous is null then 'create' else 'update' end,
    'cycle_set_aside_actual',p_cycle_id,coalesce(v_previous,'{}'::jsonb),
    jsonb_build_object('puresafeCapital',v_puresafe,'otherProductsCapital',v_other,'electricityShare',v_electricity,'toStashCash',v_stash_cash),p_note);
  return public.get_cycle_set_aside(p_cycle_id);
end;
$$;

create or replace function public.get_report_set_aside(
  p_range_key text default '30d',
  p_start_date date default null,
  p_end_date date default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_location uuid:=public.get_current_location_id();
  v_start date;
  v_end date:=coalesce(p_end_date,current_date);
  v_start_at timestamptz;
  v_end_at timestamptz;
  v_base jsonb;
  v_actual jsonb;
  v_cycles jsonb := '[]'::jsonb;
  v_tracking_started_at timestamptz;
  v_opening numeric(14,2);
  v_closing numeric(14,2);
  v_used numeric(14,2):=0;
begin
  if v_location is null then return jsonb_build_object('summary',jsonb_build_object(),'cycles','[]'::jsonb); end if;
  perform public.require_location_access(v_location,false);
  v_start:=coalesce(p_start_date,case coalesce(p_range_key,'30d') when '7d' then current_date-6 when '30d' then current_date-29
    when 'month' then date_trunc('month',current_date)::date when '3m' then (date_trunc('month',current_date)-interval '2 month')::date
    when '6m' then (date_trunc('month',current_date)-interval '5 month')::date when '1y' then (date_trunc('month',current_date)-interval '11 month')::date
    else current_date-29 end);
  v_start_at:=v_start::timestamp at time zone 'Asia/Manila';
  v_end_at:=((v_end+1)::timestamp at time zone 'Asia/Manila')-interval '1 microsecond';
  v_base:=public.get_report_set_aside_calculated(p_range_key,v_start,v_end);

  select min(bc.completed_at) into v_tracking_started_at
  from public.cycle_set_aside_actuals actual join public.box_cycles bc on bc.id=actual.cycle_id
  where actual.location_id=v_location;
  if v_tracking_started_at is not null and v_end_at>=v_tracking_started_at then
    v_opening:=case when v_start_at<=v_tracking_started_at then 0 else public.get_other_products_reserve_balance(v_location,v_start_at-interval '1 microsecond') end;
    v_closing:=public.get_other_products_reserve_balance(v_location,v_end_at);
    select coalesce(sum(sai.total_amount_paid),0) into v_used
    from public.stock_addition_items sai join public.stock_additions sa on sa.id=sai.stock_addition_id
    join public.products p on p.id=sai.product_id
    where sa.location_id=v_location and sa.voided_at is null and sa.occurred_at>=greatest(v_start_at,v_tracking_started_at) and sa.occurred_at<=v_end_at
      and not public.is_puresafe_one_litre_product(p.name,p.brand,p.variant,p.volume_text,p.unit);
  end if;

  select jsonb_build_object(
    'actualPuresafeCapital',case when count(actual.id)=0 then null else round(sum(actual.actual_puresafe_capital),2) end,
    'actualOtherProductsCapital',case when count(actual.id)=0 then null else round(sum(actual.actual_other_products_capital),2) end,
    'actualElectricityShare',case when count(actual.id)=0 then null else round(sum(actual.actual_electricity_share),2) end,
    'actualToStashCash',case when count(actual.id)=0 then null else round(sum(actual.actual_to_stash_cash),2) end,
    'actualPhysicalTotal',case when count(actual.id)=0 then null else round(sum(actual.actual_puresafe_capital+actual.actual_other_products_capital+actual.actual_electricity_share+actual.actual_to_stash_cash),2) end,
    'onlineToStash',round(coalesce(sum((calculated.detail->>'availableOnlinePayments')::numeric),0),2),
    'gcashToStash',round(coalesce(sum((calculated.detail->>'gcashPayments')::numeric),0),2),
    'mayaToStash',round(coalesce(sum((calculated.detail->>'mayaPayments')::numeric),0),2),
    'otherOnlineToStash',round(coalesce(sum((calculated.detail->>'otherOnlinePayments')::numeric),0),2),
    'usedForOtherProductRestocks',case when v_tracking_started_at is null then null else round(v_used,2) end,
    'netOtherProductsSetAside',case when v_tracking_started_at is null then null else round(coalesce(sum(actual.actual_other_products_capital),0)-v_used,2) end,
    'openingOtherProductsReserve',v_opening,'closingOtherProductsReserve',v_closing,
    'reserveTrackingStartedAt',v_tracking_started_at,
    'actualRecordedCycles',count(actual.id),'actualUnrecordedCycles',count(*)-count(actual.id)
  ), coalesce(jsonb_agg(calculated.detail order by bc.completed_at desc),'[]'::jsonb) into v_actual,v_cycles
  from public.box_cycles bc
  cross join lateral (select public.get_cycle_set_aside(bc.id) as detail) calculated
  left join public.cycle_set_aside_actuals actual on actual.cycle_id=bc.id
  where bc.location_id=v_location and bc.status='COMPLETED' and bc.completed_at between v_start_at and v_end_at;

  return jsonb_build_object('summary',coalesce(v_base->'summary','{}'::jsonb)||coalesce(v_actual,'{}'::jsonb),'cycles',v_cycles);
end;
$$;

revoke all on function public.is_puresafe_one_litre_product(text,text,text,text,text) from public,anon,authenticated;
revoke all on function public.get_other_products_reserve_balance(uuid,timestamptz) from public,anon,authenticated;
revoke all on function public.get_cycle_set_aside_calculated(uuid) from public,anon,authenticated;
revoke all on function public.get_report_set_aside_calculated(text,date,date) from public,anon,authenticated;
revoke all on function public.get_cycle_set_aside(uuid) from public,anon;
revoke all on function public.get_report_set_aside(text,date,date) from public,anon;
revoke all on function public.save_cycle_set_aside_actual(uuid,text,text,text,text,text) from public,anon;
grant execute on function public.get_cycle_set_aside(uuid) to authenticated;
grant execute on function public.get_report_set_aside(text,date,date) to authenticated;
grant execute on function public.save_cycle_set_aside_actual(uuid,text,text,text,text,text) to authenticated;

notify pgrst,'reload schema';

commit;
