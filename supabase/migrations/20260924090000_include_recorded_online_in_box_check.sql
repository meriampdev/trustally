-- Include online payments recorded separately during an active cycle in the
-- box-check preview and final collection totals without copying them into the
-- GCash/Maya values entered during the check (which would double-count them in
-- payment reporting).

begin;

do $migration$
begin
  if to_regprocedure('public.build_box_check_preview_base(uuid,text,text,text,jsonb,jsonb)') is null then
    alter function public.build_box_check_preview_internal(uuid,text,text,text,jsonb,jsonb)
      rename to build_box_check_preview_base;
  end if;
end;
$migration$;

create or replace function public.get_cycle_recorded_online_totals(p_cycle_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_cycle public.box_cycles%rowtype;
  v_payment_detail jsonb;
  v_gcash numeric(12,2) := 0;
  v_maya numeric(12,2) := 0;
  v_other numeric(12,2) := 0;
begin
  select * into v_cycle from public.box_cycles where id = p_cycle_id;
  if not found then raise exception 'Cycle not found.'; end if;
  perform public.require_location_access(v_cycle.location_id, false);

  v_payment_detail := public.get_cycle_payment_detail(p_cycle_id);
  select
    round(coalesce(sum((payment->>'amount')::numeric) filter (where payment->>'method' = 'GCASH'), 0), 2),
    round(coalesce(sum((payment->>'amount')::numeric) filter (where payment->>'method' = 'MAYA'), 0), 2),
    round(coalesce(sum((payment->>'amount')::numeric) filter (where payment->>'method' not in ('GCASH','MAYA')), 0), 2)
  into v_gcash, v_maya, v_other
  from jsonb_array_elements(coalesce(v_payment_detail->'records', '[]'::jsonb)) payment
  where payment->>'channel' = 'online'
    and payment->>'source' <> 'cycle_check_total';

  return jsonb_build_object(
    'gcash', v_gcash,
    'maya', v_maya,
    'other', v_other,
    'total', round(v_gcash + v_maya + v_other, 2)
  );
end;
$$;

create or replace function public.build_box_check_preview_internal(
  p_cycle_id uuid,
  p_cash_collected text,
  p_gcash_collected text,
  p_maya_collected text,
  p_counts jsonb,
  p_non_sale_removals jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_preview jsonb;
  v_recorded jsonb;
  v_expected numeric(12,2);
  v_total numeric(12,2);
  v_rate numeric(8,2);
begin
  v_preview := public.build_box_check_preview_base(
    p_cycle_id, p_cash_collected, p_gcash_collected, p_maya_collected,
    p_counts, p_non_sale_removals
  );
  v_recorded := public.get_cycle_recorded_online_totals(p_cycle_id);
  v_expected := coalesce((v_preview#>>'{totals,expectedRevenue}')::numeric, 0);
  v_total := round(
    coalesce((v_preview#>>'{totals,totalCollected}')::numeric, 0)
      + coalesce((v_recorded->>'total')::numeric, 0),
    2
  );
  v_rate := case when v_expected > 0 then round(v_total / v_expected * 100, 2) else null end;

  return jsonb_set(v_preview, '{totals}', (v_preview->'totals') || jsonb_build_object(
    'totalCollected', v_total,
    'differenceAmount', round(v_total - v_expected, 2),
    'honestyRate', v_rate,
    'recordedOnlinePayments', (v_recorded->>'total')::numeric,
    'recordedGcashPayments', (v_recorded->>'gcash')::numeric,
    'recordedMayaPayments', (v_recorded->>'maya')::numeric,
    'recordedOtherOnlinePayments', (v_recorded->>'other')::numeric
  ));
end;
$$;

revoke all on function public.build_box_check_preview_base(uuid,text,text,text,jsonb,jsonb) from public, anon, authenticated;
revoke all on function public.build_box_check_preview_internal(uuid,text,text,text,jsonb,jsonb) from public, anon, authenticated;
revoke all on function public.get_cycle_recorded_online_totals(uuid) from public, anon;
grant execute on function public.get_cycle_recorded_online_totals(uuid) to authenticated;

notify pgrst, 'reload schema';

commit;
