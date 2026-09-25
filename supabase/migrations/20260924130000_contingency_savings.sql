-- Add capped savings funds and redirect any normal contribution above a full
-- fund into Contingency. Existing completed-cycle snapshots remain unchanged.

begin;

alter table public.cycle_set_aside_actuals
  add column if not exists target_contingency numeric(12,2) not null default 0,
  add column if not exists actual_contingency numeric(12,2) not null default 0;

alter table public.cycle_set_aside_actuals
  drop constraint if exists cycle_set_aside_actuals_contingency_nonnegative;
alter table public.cycle_set_aside_actuals
  add constraint cycle_set_aside_actuals_contingency_nonnegative
  check (target_contingency >= 0 and actual_contingency >= 0);

create table if not exists public.set_aside_fund_baselines (
  location_id uuid primary key references public.locations(id) on delete cascade,
  puresafe_balance numeric(12,2) not null default 0,
  other_products_balance numeric(12,2) not null default 0,
  electricity_balance numeric(12,2) not null default 0,
  contingency_balance numeric(12,2) not null default 0,
  tracking_started_at timestamptz not null default now(),
  note text,
  constraint set_aside_fund_baselines_nonnegative check (
    puresafe_balance >= 0 and other_products_balance >= 0
    and electricity_balance >= 0 and contingency_balance >= 0
  )
);

-- The owner explicitly confirmed that these two funds are full now. This is a
-- balance baseline, not a fabricated Actual record for any historical cycle.
insert into public.set_aside_fund_baselines(
  location_id,puresafe_balance,other_products_balance,electricity_balance,contingency_balance,note
)
select id,1100,500,0,0,'Opening balances confirmed when Contingency savings was enabled'
from public.locations
on conflict(location_id) do nothing;

alter table public.set_aside_fund_baselines enable row level security;
revoke all on public.set_aside_fund_baselines from public,anon,authenticated;

create or replace function public.get_set_aside_fund_balances(
  p_location_id uuid,
  p_as_of timestamptz default now()
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_baseline public.set_aside_fund_baselines%rowtype;
  v_started timestamptz;
  v_actual_puresafe numeric(14,2) := 0;
  v_actual_other numeric(14,2) := 0;
  v_actual_electricity numeric(14,2) := 0;
  v_actual_contingency numeric(14,2) := 0;
  v_puresafe_used numeric(14,2) := 0;
  v_other_used numeric(14,2) := 0;
  v_puresafe numeric(14,2);
  v_other numeric(14,2);
  v_electricity numeric(14,2);
  v_contingency numeric(14,2);
begin
  perform public.require_location_access(p_location_id,false);
  select * into v_baseline from public.set_aside_fund_baselines where location_id=p_location_id;
  v_started:=coalesce(v_baseline.tracking_started_at,'-infinity'::timestamptz);

  select
    round(coalesce(sum(actual_puresafe_capital),0),2),
    round(coalesce(sum(actual_other_products_capital),0),2),
    round(coalesce(sum(actual_electricity_share),0),2),
    round(coalesce(sum(actual_contingency),0),2)
  into v_actual_puresafe,v_actual_other,v_actual_electricity,v_actual_contingency
  from public.cycle_set_aside_actuals
  where location_id=p_location_id and recorded_at>=v_started and recorded_at<=p_as_of;

  select
    round(coalesce(sum(sai.total_amount_paid) filter (where public.is_puresafe_one_litre_product(p.name,p.brand,p.variant,p.volume_text,p.unit)),0),2),
    round(coalesce(sum(sai.total_amount_paid) filter (where not public.is_puresafe_one_litre_product(p.name,p.brand,p.variant,p.volume_text,p.unit)),0),2)
  into v_puresafe_used,v_other_used
  from public.stock_addition_items sai
  join public.stock_additions sa on sa.id=sai.stock_addition_id
  join public.products p on p.id=sai.product_id
  where sa.location_id=p_location_id and sa.voided_at is null
    and sa.occurred_at>=v_started and sa.occurred_at<=p_as_of;

  v_puresafe:=round(coalesce(v_baseline.puresafe_balance,0)+v_actual_puresafe-v_puresafe_used,2);
  v_other:=round(coalesce(v_baseline.other_products_balance,0)+v_actual_other-v_other_used,2);
  v_electricity:=round(coalesce(v_baseline.electricity_balance,0)+v_actual_electricity,2);
  v_contingency:=round(coalesce(v_baseline.contingency_balance,0)+v_actual_contingency,2);

  return jsonb_build_object(
    'trackingStartedAt',nullif(v_started,'-infinity'::timestamptz),
    'puresafe',jsonb_build_object('goal',1100,'balance',v_puresafe,'remaining',greatest(1100-v_puresafe,0),'goalMet',v_puresafe>=1100,'used',v_puresafe_used),
    'otherProducts',jsonb_build_object('goal',500,'balance',v_other,'remaining',greatest(500-v_other,0),'goalMet',v_other>=500,'used',v_other_used),
    'electricity',jsonb_build_object('goal',2000,'balance',v_electricity,'remaining',greatest(2000-v_electricity,0),'goalMet',v_electricity>=2000),
    'contingency',jsonb_build_object('balance',v_contingency)
  );
end;
$$;

do $migration$
begin
  if to_regprocedure('public.get_cycle_set_aside_before_contingency(uuid)') is null then
    alter function public.get_cycle_set_aside(uuid) rename to get_cycle_set_aside_before_contingency;
  end if;
  if to_regprocedure('public.get_report_set_aside_before_contingency(text,date,date)') is null then
    alter function public.get_report_set_aside(text,date,date) rename to get_report_set_aside_before_contingency;
  end if;
end;
$migration$;

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
  v_funds jsonb;
  v_baseline_started timestamptz;
  v_apply_caps boolean := false;
  v_original_puresafe numeric(12,2);
  v_original_other numeric(12,2);
  v_original_electricity numeric(12,2);
  v_puresafe numeric(12,2);
  v_other numeric(12,2);
  v_electricity numeric(12,2);
  v_contingency numeric(12,2) := 0;
begin
  select * into v_cycle from public.box_cycles where id=p_cycle_id;
  if not found then raise exception 'Cycle not found.'; end if;
  perform public.require_location_access(v_cycle.location_id,false);
  v_detail:=public.get_cycle_set_aside_before_contingency(p_cycle_id);
  v_funds:=public.get_set_aside_fund_balances(v_cycle.location_id,now());
  v_baseline_started:=nullif(v_funds->>'trackingStartedAt','')::timestamptz;
  select * into v_actual from public.cycle_set_aside_actuals where cycle_id=p_cycle_id;

  v_apply_caps:=v_actual.id is null and (
    v_cycle.status='ACTIVE' or v_baseline_started is null
    or coalesce(v_cycle.completed_at,v_cycle.started_at)>=v_baseline_started
  );

  if v_apply_caps then
    v_original_puresafe:=(v_detail->>'puresafeCapital')::numeric;
    v_original_other:=(v_detail->>'miscCapital')::numeric;
    v_original_electricity:=coalesce((v_detail->>'electricityShare')::numeric,0);
    v_puresafe:=case when v_original_puresafe is null then null else least(v_original_puresafe,greatest((v_funds#>>'{puresafe,remaining}')::numeric,0)) end;
    v_other:=case when v_original_other is null then null else least(v_original_other,greatest((v_funds#>>'{otherProducts,remaining}')::numeric,0)) end;
    v_electricity:=least(v_original_electricity,greatest((v_funds#>>'{electricity,remaining}')::numeric,0));
    v_contingency:=round(
      coalesce(v_original_puresafe-v_puresafe,0)+coalesce(v_original_other-v_other,0)+(v_original_electricity-v_electricity),2
    );
    v_detail:=v_detail||jsonb_build_object(
      'originalPuresafeCapital',v_original_puresafe,'originalMiscCapital',v_original_other,'originalElectricityShare',v_original_electricity,
      'puresafeCapital',v_puresafe,'miscCapital',v_other,'electricityShare',v_electricity,'contingencyCapital',v_contingency,
      'totalSetAside',case when v_puresafe is null or v_other is null then null else round(v_puresafe+v_other+v_electricity+v_contingency,2) end
    );
  else
    v_detail:=v_detail||jsonb_build_object('contingencyCapital',coalesce(v_actual.target_contingency,0));
  end if;

  if v_actual.id is not null then
    v_detail:=jsonb_set(v_detail,'{actualSetAside}',(v_detail->'actualSetAside')||jsonb_build_object(
      'contingency',v_actual.actual_contingency,
      'physicalCashTotal',round(v_actual.actual_puresafe_capital+v_actual.actual_other_products_capital+v_actual.actual_electricity_share+v_actual.actual_contingency+v_actual.actual_to_stash_cash,2)
    ));
  end if;
  return v_detail||jsonb_build_object('fundBalances',v_funds);
end;
$$;

drop function if exists public.save_cycle_set_aside_actual(uuid,text,text,text,text,text);
create or replace function public.save_cycle_set_aside_actual(
  p_cycle_id uuid,
  p_actual_puresafe_capital text,
  p_actual_other_products_capital text,
  p_actual_electricity_share text,
  p_actual_contingency text,
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
  v_contingency numeric(12,2):=round(coalesce(nullif(btrim(coalesce(p_actual_contingency,'')),'')::numeric,0),2);
  v_stash_cash numeric(12,2):=round(coalesce(nullif(btrim(coalesce(p_actual_to_stash_cash,'')),'')::numeric,0),2);
begin
  if v_user is null then raise exception 'Authentication required.'; end if;
  select * into v_cycle from public.box_cycles where id=p_cycle_id for update;
  if not found then raise exception 'Cycle not found.'; end if;
  perform public.require_location_access(v_cycle.location_id,false);
  if v_cycle.status<>'COMPLETED' or v_cycle.completed_at is null then raise exception 'Actual set aside can only be recorded for a completed cycle.'; end if;
  if least(v_puresafe,v_other,v_electricity,v_contingency,v_stash_cash)<0 then raise exception 'Actual amounts cannot be negative.'; end if;
  v_detail:=public.get_cycle_set_aside(p_cycle_id);
  if v_puresafe+v_other+v_electricity+v_contingency+v_stash_cash>(v_detail->>'cashAvailableAfterChangeFloat')::numeric then
    raise exception 'Actual set aside cannot exceed the physical cash available after Change Float.';
  end if;
  select to_jsonb(actual) into v_previous from public.cycle_set_aside_actuals actual where cycle_id=p_cycle_id;

  insert into public.cycle_set_aside_actuals(location_id,cycle_id,target_puresafe_capital,target_other_products_capital,target_electricity_share,
    target_contingency,target_to_stash,target_cash_shortfall,online_to_stash,actual_puresafe_capital,actual_other_products_capital,
    actual_electricity_share,actual_contingency,actual_to_stash_cash,note,recorded_by,updated_by)
  values(v_cycle.location_id,v_cycle.id,(v_detail->>'puresafeCapital')::numeric,(v_detail->>'miscCapital')::numeric,
    (v_detail->>'electricityShare')::numeric,coalesce((v_detail->>'contingencyCapital')::numeric,0),(v_detail->>'remainingEarnings')::numeric,
    (v_detail->>'shortfall')::numeric,(v_detail->>'availableOnlinePayments')::numeric,v_puresafe,v_other,v_electricity,v_contingency,v_stash_cash,
    nullif(btrim(coalesce(p_note,'')),''),v_user,v_user)
  on conflict(cycle_id) do update set
    online_to_stash=excluded.online_to_stash,actual_puresafe_capital=excluded.actual_puresafe_capital,
    actual_other_products_capital=excluded.actual_other_products_capital,actual_electricity_share=excluded.actual_electricity_share,
    actual_contingency=excluded.actual_contingency,actual_to_stash_cash=excluded.actual_to_stash_cash,
    note=excluded.note,updated_by=v_user,updated_at=now();

  perform public.record_audit_log(v_cycle.location_id,case when v_previous is null then 'create' else 'update' end,
    'cycle_set_aside_actual',p_cycle_id,coalesce(v_previous,'{}'::jsonb),
    jsonb_build_object('puresafeCapital',v_puresafe,'otherProductsCapital',v_other,'electricityShare',v_electricity,'contingency',v_contingency,'toStashCash',v_stash_cash),p_note);
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
  v_report jsonb;
  v_cycles jsonb;
  v_summary jsonb;
  v_contingency numeric(14,2) := 0;
  v_actual_contingency numeric(14,2);
  v_actual_total numeric(14,2);
  v_location uuid:=public.get_current_location_id();
  v_funds jsonb;
begin
  v_report:=public.get_report_set_aside_before_contingency(p_range_key,p_start_date,p_end_date);
  v_cycles:=coalesce(v_report->'cycles','[]'::jsonb);
  select
    round(coalesce(sum((cycle->>'contingencyCapital')::numeric),0),2),
    case when count(*) filter(where cycle->'actualSetAside' is not null and cycle->'actualSetAside'<>'null'::jsonb)=0 then null
      else round(sum((cycle#>>'{actualSetAside,contingency}')::numeric),2) end,
    case when count(*) filter(where cycle->'actualSetAside' is not null and cycle->'actualSetAside'<>'null'::jsonb)=0 then null
      else round(sum((cycle#>>'{actualSetAside,physicalCashTotal}')::numeric),2) end
  into v_contingency,v_actual_contingency,v_actual_total
  from jsonb_array_elements(v_cycles) cycle;
  v_funds:=case when v_location is null then null else public.get_set_aside_fund_balances(v_location,now()) end;
  v_summary:=coalesce(v_report->'summary','{}'::jsonb)||jsonb_build_object(
    'contingencyCapital',v_contingency,'actualContingency',v_actual_contingency,'actualPhysicalTotal',v_actual_total,'fundBalances',v_funds
  );
  return jsonb_build_object('summary',v_summary,'cycles',v_cycles);
end;
$$;

revoke all on function public.get_set_aside_fund_balances(uuid,timestamptz) from public,anon;
revoke all on function public.get_cycle_set_aside_before_contingency(uuid) from public,anon,authenticated;
revoke all on function public.get_report_set_aside_before_contingency(text,date,date) from public,anon,authenticated;
revoke all on function public.get_cycle_set_aside(uuid) from public,anon;
revoke all on function public.get_report_set_aside(text,date,date) from public,anon;
revoke all on function public.save_cycle_set_aside_actual(uuid,text,text,text,text,text,text) from public,anon;
grant execute on function public.get_set_aside_fund_balances(uuid,timestamptz) to authenticated;
grant execute on function public.get_cycle_set_aside(uuid) to authenticated;
grant execute on function public.get_report_set_aside(text,date,date) to authenticated;
grant execute on function public.save_cycle_set_aside_actual(uuid,text,text,text,text,text,text) to authenticated;

notify pgrst,'reload schema';

commit;
