-- Run after all migrations in an isolated database.
create or replace function auth.uid()
returns uuid language sql stable
as $$ select '00000000-0000-0000-0000-000000000002'::uuid $$;

insert into auth.users(id,email,raw_user_meta_data)
values('00000000-0000-0000-0000-000000000002','set-aside-test@example.com','{"full_name":"Set Aside Test"}');

do $$
declare
  v_user constant uuid:='00000000-0000-0000-0000-000000000002';
  v_location constant uuid:='10000000-0000-0000-0000-000000000002';
  v_product constant uuid:='20000000-0000-0000-0000-000000000002';
  v_cycle constant uuid:='30000000-0000-0000-0000-000000000002';
  v_next_cycle constant uuid:='30000000-0000-0000-0000-000000000003';
  v_detail jsonb; v_report jsonb; v_count integer;
begin
  insert into public.locations(id,owner_user_id,name) values(v_location,v_user,'Set Aside test location');
  insert into public.location_members(location_id,user_id,role) values(v_location,v_user,'OWNER');
  update public.user_settings set current_location_id=v_location where user_id=v_user;
  insert into public.products(id,location_id,name,category,default_unit_cost,current_selling_price,created_by)
    values(v_product,v_location,'Other Drink','Drinks',10,20,v_user);
  insert into public.box_cycles(id,location_id,cycle_number,status,created_by,started_at)
    values(v_cycle,v_location,1,'ACTIVE',v_user,'2026-09-10 08:00+08');
  insert into public.box_cycle_items(cycle_id,product_id,product_name,starting_quantity,available_quantity,unit_cost_snapshot,selling_price_snapshot)
    values(v_cycle,v_product,'Other Drink',20,20,10,20);
  update public.box_cycle_items set ending_quantity=10,units_taken=10,expected_revenue=200,cogs=100,gross_profit=100
    where cycle_id=v_cycle and product_id=v_product;
  update public.box_cycles set status='COMPLETED',completed_at='2026-09-11 08:00+08',cash_counted_before_withdrawal=200,
    cash_collected=160,gcash_collected=40,maya_collected=0,total_collected=200,total_payments_received=200,
    cash_returned_amount=20,expected_revenue=200,cogs=100,gross_profit=100 where id=v_cycle;

  v_detail:=public.get_cycle_set_aside(v_cycle);
  if v_detail->>'actualSetAside' is not null then raise exception 'Old completed cycle should be Not recorded'; end if;
  v_detail:=public.save_cycle_set_aside_actual(v_cycle,'0','100','50','0','30','Counted envelopes');
  if (v_detail#>>'{actualSetAside,otherProductsCapital}')::numeric<>100 then raise exception 'Expected actual Other Products amount of 100'; end if;
  if (v_detail#>>'{actualSetAside,onlineToStash}')::numeric<>40 then raise exception 'Expected all 40 online payments to go to Stash'; end if;
  if (v_detail->>'gcashPayments')::numeric<>40 or (v_detail->>'mayaPayments')::numeric<>0 then raise exception 'Expected separate GCash and Maya amounts'; end if;
  if (v_detail#>>'{otherProductsReserve,closingBalance}')::numeric<>100 then raise exception 'Expected initial reserve balance of 100'; end if;

  insert into public.box_cycles(id,location_id,cycle_number,status,created_by,started_at)
    values(v_next_cycle,v_location,2,'ACTIVE',v_user,'2026-09-11 08:01+08');
  insert into public.box_cycle_items(cycle_id,product_id,product_name,starting_quantity,available_quantity,unit_cost_snapshot,selling_price_snapshot)
    values(v_next_cycle,v_product,'Other Drink',10,10,10,20);
  perform public.create_inventory_restock(v_product,5,'2026-09-12 09:00+08','50','','20','Supplier','SET-001','Reserve-funded restock','{}',
    '40000000-0000-0000-0000-000000000003');
  if public.get_other_products_reserve_balance(v_location,'2026-09-12 10:00+08')<>50 then raise exception 'Expected reserve of 50 after a 50 restock'; end if;

  v_report:=public.get_report_set_aside('custom','2026-09-01','2026-09-30');
  if (v_report#>>'{summary,actualOtherProductsCapital}')::numeric<>100 then raise exception 'Expected report actual of 100'; end if;
  if (v_report#>>'{summary,usedForOtherProductRestocks}')::numeric<>50 then raise exception 'Expected report restock use of 50'; end if;
  if (v_report#>>'{summary,netOtherProductsSetAside}')::numeric<>50 then raise exception 'Expected net set aside of 50'; end if;
  if (v_report#>>'{summary,openingOtherProductsReserve}')::numeric<>0 then raise exception 'Expected opening reserve of 0'; end if;
  if (v_report#>>'{summary,closingOtherProductsReserve}')::numeric<>50 then raise exception 'Expected closing reserve of 50'; end if;
  if (v_report#>>'{summary,gcashToStash}')::numeric<>40 or (v_report#>>'{summary,mayaToStash}')::numeric<>0 then raise exception 'Expected report GCash and Maya totals'; end if;
  if v_report#>>'{cycles,0,actualSetAside,otherProductsCapital}' is null then raise exception 'Expected report cycles to include their Actual Set Aside record'; end if;
  select count(*) into v_count from public.expenses e where e.stock_addition_item_id is not null and e.product_id=v_product and e.archived_at is null;
  if v_count<>1 then raise exception 'Expected exactly one automatic restock expense'; end if;

  update public.box_cycles set opening_change_float=0 where id=v_next_cycle;
  perform public.record_payment_receipt('75','GCASH','2026-09-12 10:00+08','CURRENT','Recorded before box check','[]',false,v_next_cycle);
  v_detail:=public.preview_box_check_with_float('0','0','20','0','[]','[]','0',null);
  if (v_detail#>>'{totals,recordedGcashPayments}')::numeric<>75 then raise exception 'Expected separately recorded GCash of 75 in preview'; end if;
  if (v_detail#>>'{totals,totalCollected}')::numeric<>95 then raise exception 'Expected entered and separately recorded online payments in preview total'; end if;
  v_detail:=public.complete_box_check_with_float('0','0','20','0','[]','[]','[]',null,'0',null,'40000000-0000-0000-0000-000000000004');
  if (select total_collected from public.box_cycles where id=v_next_cycle)<>95 then raise exception 'Expected separately recorded online payment in completed cycle total'; end if;
  v_detail:=public.get_cycle_payment_detail(v_next_cycle);
  if (v_detail#>>'{summary,onlinePayments}')::numeric<>95 then raise exception 'Expected payment detail total of 95 without double-counting'; end if;

  begin
    perform public.save_cycle_set_aside_actual(v_cycle,'100','100','50','0','30','Too much cash');
    raise exception 'Expected physical-cash validation to reject the record';
  exception when others then
    if sqlerrm not like 'Actual set aside cannot exceed%' then raise; end if;
  end;
end $$;

select 'actual set-aside tracking integration test passed' as result;
