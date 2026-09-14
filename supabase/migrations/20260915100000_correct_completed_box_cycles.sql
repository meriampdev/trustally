-- Allow an owner to correct the facts captured when a box cycle was completed.
-- Inventory corrections are carried forward so later cycles keep a coherent
-- opening balance. The whole function is transactional: an impossible later
-- cycle rejects the correction instead of leaving partial data behind.

begin;

create or replace function public.correct_completed_box_cycle(
  p_cycle_id uuid,
  p_cash_counted_before_withdrawal text,
  p_closing_change_float text,
  p_gcash_collected text,
  p_maya_collected text,
  p_counts jsonb,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_cycle public.box_cycles%rowtype;
  v_later_cycle public.box_cycles%rowtype;
  v_previous_cycle_id uuid;
  v_invalid record;
  v_counted numeric(12,2);
  v_closing numeric(12,2);
  v_gcash numeric(12,2);
  v_maya numeric(12,2);
  v_generated numeric(12,2);
  v_expected numeric(12,2);
  v_cogs numeric(12,2);
  v_gross_profit numeric(12,2);
  v_total numeric(12,2);
  v_previous jsonb;
  v_new jsonb;
begin
  if v_user_id is null then
    raise exception 'Authentication required.';
  end if;
  if nullif(btrim(coalesce(p_reason, '')), '') is null then
    raise exception 'A reason for the correction is required.';
  end if;

  select * into v_cycle
  from public.box_cycles bc
  where bc.id = p_cycle_id
  for update;

  if not found then raise exception 'Cycle not found.'; end if;
  perform public.require_location_access(v_cycle.location_id, true);
  if v_cycle.status <> 'COMPLETED' then
    raise exception 'Only completed cycles can be corrected.';
  end if;
  if v_cycle.opening_change_float is null then
    raise exception 'Set this cycle''s opening change float before correcting its cash count.';
  end if;

  -- Lock the chain before validating or updating any inventory balance.
  perform 1
  from public.box_cycles bc
  where bc.location_id = v_cycle.location_id
    and bc.status <> 'VOIDED'
    and bc.cycle_number >= v_cycle.cycle_number
  order by bc.cycle_number
  for update;

  v_counted := round(coalesce(nullif(btrim(coalesce(p_cash_counted_before_withdrawal, '')), '')::numeric, 0), 2);
  v_closing := round(coalesce(nullif(btrim(coalesce(p_closing_change_float, '')), '')::numeric, 0), 2);
  v_gcash := round(coalesce(nullif(btrim(coalesce(p_gcash_collected, '')), '')::numeric, 0), 2);
  v_maya := round(coalesce(nullif(btrim(coalesce(p_maya_collected, '')), '')::numeric, 0), 2);

  if least(v_counted, v_closing, v_gcash, v_maya) < 0 then
    raise exception 'Amounts cannot be negative.';
  end if;
  if v_closing > v_counted + coalesce(v_cycle.tracked_non_sales_cash_added, 0) then
    raise exception 'Left for Change cannot exceed counted cash plus tracked non-sales cash added.';
  end if;

  v_generated := round(
    v_counted
      + coalesce(v_cycle.cash_removed_amount, 0)
      - v_cycle.opening_change_float
      - coalesce(v_cycle.tracked_non_sales_cash_added, 0),
    2
  );
  if v_generated < 0 then
    raise exception 'The corrected cash count would make customer cash generated negative.';
  end if;

  -- Reject unknown or duplicate product rows supplied by a stale client.
  if exists (
    select 1
    from jsonb_to_recordset(coalesce(p_counts, '[]'::jsonb)) as c("productId" uuid, "endingQuantity" integer)
    left join public.box_cycle_items bci
      on bci.cycle_id = p_cycle_id and bci.product_id = c."productId"
    where bci.id is null or c."endingQuantity" is null or c."endingQuantity" < 0
  ) then
    raise exception 'One or more corrected product counts are invalid.';
  end if;
  if exists (
    select c."productId"
    from jsonb_to_recordset(coalesce(p_counts, '[]'::jsonb)) as c("productId" uuid, "endingQuantity" integer)
    group by c."productId"
    having count(*) > 1
  ) then
    raise exception 'A product count was supplied more than once.';
  end if;

  select bci.product_name, bci.available_quantity, bci.non_sale_quantity, c."endingQuantity" as ending_quantity
  into v_invalid
  from jsonb_to_recordset(coalesce(p_counts, '[]'::jsonb)) as c("productId" uuid, "endingQuantity" integer)
  join public.box_cycle_items bci
    on bci.cycle_id = p_cycle_id and bci.product_id = c."productId"
  where c."endingQuantity" + bci.non_sale_quantity > bci.available_quantity
  limit 1;
  if found then
    raise exception 'The corrected count for % exceeds available stock after non-sale removals.', v_invalid.product_name;
  end if;

  v_previous := jsonb_build_object(
    'cashCountedBeforeWithdrawal', v_cycle.cash_counted_before_withdrawal,
    'closingChangeFloat', v_cycle.cash_returned_amount,
    'gcashCollected', v_cycle.gcash_collected,
    'mayaCollected', v_cycle.maya_collected,
    'counts', (select coalesce(jsonb_object_agg(bci.product_id, bci.ending_quantity), '{}'::jsonb) from public.box_cycle_items bci where bci.cycle_id = p_cycle_id)
  );

  update public.box_cycle_items bci
  set ending_quantity = c."endingQuantity",
      units_taken = bci.available_quantity - bci.non_sale_quantity - c."endingQuantity",
      expected_revenue = round((bci.available_quantity - bci.non_sale_quantity - c."endingQuantity") * bci.selling_price_snapshot, 2),
      cogs = round((bci.available_quantity - bci.non_sale_quantity - c."endingQuantity") * bci.unit_cost_snapshot, 2),
      gross_profit = round((bci.available_quantity - bci.non_sale_quantity - c."endingQuantity") * (bci.selling_price_snapshot - bci.unit_cost_snapshot), 2)
  from jsonb_to_recordset(coalesce(p_counts, '[]'::jsonb)) as c("productId" uuid, "endingQuantity" integer)
  where bci.cycle_id = p_cycle_id and bci.product_id = c."productId";

  select round(coalesce(sum(expected_revenue), 0), 2),
         round(coalesce(sum(cogs), 0), 2),
         round(coalesce(sum(gross_profit), 0), 2)
  into v_expected, v_cogs, v_gross_profit
  from public.box_cycle_items
  where cycle_id = p_cycle_id;
  v_total := round(v_generated + v_gcash + v_maya, 2);

  perform set_config('trustally.allow_closing_float_update', 'on', true);
  update public.box_cycles bc
  set cash_counted_before_withdrawal = v_counted,
      cash_generated = v_generated,
      cash_withdrawn = round(v_counted - v_closing, 2),
      cash_returned_amount = v_closing,
      cash_collected = v_generated,
      gcash_collected = v_gcash,
      maya_collected = v_maya,
      total_collected = v_total,
      expected_revenue = v_expected,
      difference_amount = round(v_total - v_expected, 2),
      honesty_rate = case when v_expected > 0 then round(v_total / v_expected * 100, 2) else null end,
      cogs = v_cogs,
      gross_profit = v_gross_profit,
      gross_margin = case when v_expected > 0 then round(v_gross_profit / v_expected * 100, 2) else null end
  where bc.id = p_cycle_id;
  perform set_config('trustally.allow_closing_float_update', 'off', true);

  -- Carry the corrected ending balances into every later cycle. Refill stock is
  -- part of the next cycle's opening quantity; ordinary additions remain in
  -- stock_added_quantity.
  v_previous_cycle_id := p_cycle_id;
  for v_later_cycle in
    select *
    from public.box_cycles bc
    where bc.location_id = v_cycle.location_id
      and bc.status <> 'VOIDED'
      and bc.cycle_number > v_cycle.cycle_number
    order by bc.cycle_number
  loop
    with prior as (
      select product_id, coalesce(ending_quantity, 0) ending_quantity
      from public.box_cycle_items
      where cycle_id = v_previous_cycle_id
    ), refills as (
      select sai.product_id, sum(sai.quantity)::integer quantity
      from public.stock_additions sa
      join public.stock_addition_items sai on sai.stock_addition_id = sa.id
      where sa.cycle_id = v_later_cycle.id and sa.is_cycle_refill
      group by sai.product_id
    )
    update public.box_cycle_items bci
    set starting_quantity = coalesce(prior.ending_quantity, 0) + coalesce(refills.quantity, 0),
        available_quantity = coalesce(prior.ending_quantity, 0) + coalesce(refills.quantity, 0) + bci.stock_added_quantity
    from prior
    full join refills using (product_id)
    where bci.cycle_id = v_later_cycle.id
      and bci.product_id = coalesce(prior.product_id, refills.product_id);

    select bci.product_name, bci.available_quantity, bci.non_sale_quantity, bci.ending_quantity
    into v_invalid
    from public.box_cycle_items bci
    where bci.cycle_id = v_later_cycle.id
      and v_later_cycle.status = 'COMPLETED'
      and coalesce(bci.ending_quantity, 0) + bci.non_sale_quantity > bci.available_quantity
    limit 1;
    if found then
      raise exception 'This correction conflicts with % in Cycle #%: its later count would exceed corrected available stock.', v_invalid.product_name, v_later_cycle.cycle_number;
    end if;

    if v_later_cycle.status = 'COMPLETED' then
      update public.box_cycle_items bci
      set units_taken = bci.available_quantity - bci.non_sale_quantity - coalesce(bci.ending_quantity, 0),
          expected_revenue = round((bci.available_quantity - bci.non_sale_quantity - coalesce(bci.ending_quantity, 0)) * bci.selling_price_snapshot, 2),
          cogs = round((bci.available_quantity - bci.non_sale_quantity - coalesce(bci.ending_quantity, 0)) * bci.unit_cost_snapshot, 2),
          gross_profit = round((bci.available_quantity - bci.non_sale_quantity - coalesce(bci.ending_quantity, 0)) * (bci.selling_price_snapshot - bci.unit_cost_snapshot), 2)
      where bci.cycle_id = v_later_cycle.id;

      select round(coalesce(sum(expected_revenue), 0), 2),
             round(coalesce(sum(cogs), 0), 2),
             round(coalesce(sum(gross_profit), 0), 2)
      into v_expected, v_cogs, v_gross_profit
      from public.box_cycle_items
      where cycle_id = v_later_cycle.id;

      update public.box_cycles bc
      set expected_revenue = v_expected,
          difference_amount = round(coalesce(bc.total_collected, 0) - v_expected, 2),
          honesty_rate = case when v_expected > 0 then round(coalesce(bc.total_collected, 0) / v_expected * 100, 2) else null end,
          cogs = v_cogs,
          gross_profit = v_gross_profit,
          gross_margin = case when v_expected > 0 then round(v_gross_profit / v_expected * 100, 2) else null end
      where bc.id = v_later_cycle.id;
      perform public.sync_cycle_financials(v_later_cycle.id);
    end if;
    v_previous_cycle_id := v_later_cycle.id;
  end loop;

  perform public.recalculate_change_float_chain(v_cycle.location_id, p_cycle_id);

  -- A changed closing float changes the derived opening (and therefore customer
  -- cash generated) in following cycles. Persist those derived payment totals so
  -- every API—not only the client-side compatibility layer—sees the correction.
  for v_later_cycle in
    select *
    from public.box_cycles bc
    where bc.location_id = v_cycle.location_id
      and bc.status = 'COMPLETED'
      and bc.cycle_number >= v_cycle.cycle_number
    order by bc.cycle_number
  loop
    update public.box_cycles bc
    set cash_collected = coalesce(bc.cash_generated, bc.cash_collected, 0),
        total_collected = round(coalesce(bc.cash_generated, bc.cash_collected, 0) + coalesce(bc.gcash_collected, 0) + coalesce(bc.maya_collected, 0), 2),
        difference_amount = round(coalesce(bc.cash_generated, bc.cash_collected, 0) + coalesce(bc.gcash_collected, 0) + coalesce(bc.maya_collected, 0) - coalesce(bc.expected_revenue, 0), 2),
        honesty_rate = case
          when coalesce(bc.expected_revenue, 0) > 0
            then round((coalesce(bc.cash_generated, bc.cash_collected, 0) + coalesce(bc.gcash_collected, 0) + coalesce(bc.maya_collected, 0)) / bc.expected_revenue * 100, 2)
          else null
        end
    where bc.id = v_later_cycle.id;
    perform public.sync_cycle_financials(v_later_cycle.id);
  end loop;

  v_new := jsonb_build_object(
    'cashCountedBeforeWithdrawal', v_counted,
    'closingChangeFloat', v_closing,
    'gcashCollected', v_gcash,
    'mayaCollected', v_maya,
    'counts', (select coalesce(jsonb_object_agg(bci.product_id, bci.ending_quantity), '{}'::jsonb) from public.box_cycle_items bci where bci.cycle_id = p_cycle_id)
  );
  perform public.record_audit_log(
    v_cycle.location_id,
    'correct',
    'box_cycle',
    p_cycle_id,
    v_previous,
    v_new,
    btrim(p_reason)
  );

  return jsonb_build_object('cycleId', p_cycle_id, 'corrected', true);
end;
$$;

revoke all on function public.correct_completed_box_cycle(uuid, text, text, text, text, jsonb, text) from public, anon;
grant execute on function public.correct_completed_box_cycle(uuid, text, text, text, text, jsonb, text) to authenticated;

notify pgrst, 'reload schema';

commit;
