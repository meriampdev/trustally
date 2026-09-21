-- Run after all migrations in an isolated PostgreSQL database.
-- This test intentionally uses fixed IDs so every assertion is deterministic.
create or replace function auth.uid()
returns uuid language sql stable
as $$ select '00000000-0000-0000-0000-000000000001'::uuid $$;

insert into auth.users (id, email, raw_user_meta_data)
values ('00000000-0000-0000-0000-000000000001', 'accounting-test@example.com', '{"full_name":"Accounting Test"}');

do $$
declare
  v_user constant uuid := '00000000-0000-0000-0000-000000000001';
  v_location constant uuid := '10000000-0000-0000-0000-000000000001';
  v_product constant uuid := '20000000-0000-0000-0000-000000000001';
  v_cycle constant uuid := '30000000-0000-0000-0000-000000000001';
  v_restock uuid;
  v_removal uuid;
  v_result jsonb;
  v_number numeric;
  v_count integer;
begin
  insert into public.locations(id,owner_user_id,name) values(v_location,v_user,'Accounting test location');
  insert into public.location_members(location_id,user_id,role) values(v_location,v_user,'OWNER');
  update public.user_settings set current_location_id=v_location where user_id=v_user;
  insert into public.products(id,location_id,name,category,default_unit_cost,current_selling_price,created_by)
    values(v_product,v_location,'Refresh','Drinks',15,30,v_user);
  insert into public.box_cycles(id,location_id,cycle_number,status,created_by,started_at)
    values(v_cycle,v_location,1,'ACTIVE',v_user,'2026-09-01 08:00+08');
  insert into public.box_cycle_items(cycle_id,product_id,product_name,starting_quantity,available_quantity,unit_cost_snapshot,selling_price_snapshot)
    values(v_cycle,v_product,'Refresh',5,5,15,30);

  v_result:=public.create_inventory_restock(v_product,24,'2026-09-02 09:00+08','360','','30','Supplier A','R-001','Initial restock','{}',
    '40000000-0000-0000-0000-000000000001');
  v_restock:=(v_result->>'restockId')::uuid;
  select current_quantity into v_count from public.product_inventory_accounts where product_id=v_product;
  if v_count<>29 then raise exception 'Expected 29 units after restock, got %',v_count; end if;
  select inventory_value into v_number from public.product_inventory_accounts where product_id=v_product;
  if v_number<>435 then raise exception 'Expected inventory value 435, got %',v_number; end if;
  select count(*) into v_count from public.expenses where stock_addition_item_id=v_restock and archived_at is null;
  if v_count<>1 then raise exception 'Expected exactly one linked expense, got %',v_count; end if;

  perform public.update_inventory_restock(v_restock,20,'2026-09-02 10:00+08','300','','Supplier B','R-002','Corrected quantity');
  select current_quantity into v_count from public.product_inventory_accounts where product_id=v_product;
  if v_count<>25 then raise exception 'Expected 25 units after correction, got %',v_count; end if;
  select inventory_value into v_number from public.product_inventory_accounts where product_id=v_product;
  if v_number<>375 then raise exception 'Expected inventory value 375 after correction, got %',v_number; end if;
  select amount into v_number from public.expenses where stock_addition_item_id=v_restock and archived_at is null;
  if v_number<>300 then raise exception 'Expected corrected linked expense of 300, got %',v_number; end if;

  perform public.archive_inventory_restock(v_restock,'Test reversal');
  select current_quantity into v_count from public.product_inventory_accounts where product_id=v_product;
  if v_count<>5 then raise exception 'Expected opening 5 units after reversal, got %',v_count; end if;
  select inventory_value into v_number from public.product_inventory_accounts where product_id=v_product;
  if v_number<>75 then raise exception 'Expected opening inventory value 75 after reversal, got %',v_number; end if;
  select count(*) into v_count from public.expenses where stock_addition_item_id=v_restock and archived_at is null;
  if v_count<>0 then raise exception 'Expected linked expense to be archived'; end if;

  v_result:=public.create_inventory_restock(v_product,24,'2026-09-03 09:00+08','360','','30','Supplier A','R-003','Replacement restock','{}',
    '40000000-0000-0000-0000-000000000002');
  v_restock:=(v_result->>'restockId')::uuid;
  insert into public.non_sale_removals(location_id,cycle_id,created_by) values(v_location,v_cycle,v_user) returning id into v_removal;
  insert into public.non_sale_removal_items(non_sale_removal_id,product_id,reason,quantity,note)
    values(v_removal,v_product,'DAMAGED',1,'Broken bottle');
  select count(*) into v_count from public.stock_movements
    where product_id=v_product and movement_type='DAMAGED' and quantity_out=1 and voided_at is null;
  if v_count<>1 then raise exception 'Expected one damaged-stock movement, got %',v_count; end if;

  v_result:=public.save_puresafe_cost_settings(v_product,119,'571','2','25','16','1','2','3','4');
  if (v_result->>'bottlePackUnits')::integer<>119 then raise exception 'Puresafe settings were not saved'; end if;

  update public.box_cycle_items set non_sale_quantity=1,ending_quantity=19,units_taken=9,expected_revenue=270,cogs=135,gross_profit=135
    where cycle_id=v_cycle and product_id=v_product;
  update public.box_cycles set status='COMPLETED',completed_at='2026-09-04 18:00+08',expected_revenue=270,cogs=135,gross_profit=135,
    cash_collected=270,total_collected=270,total_payments_received=270 where id=v_cycle;
  select capital_recovered into v_number from public.sale_cost_records where cycle_id=v_cycle and product_id=v_product;
  if v_number<>135 then raise exception 'Expected immutable sale COGS of 135, got %',v_number; end if;
  select current_quantity into v_count from public.product_inventory_accounts where product_id=v_product;
  if v_count<>19 then raise exception 'Expected final stock of 19, got %',v_count; end if;
  v_result:=public.get_business_accounting_report('2026-09-01 00:00+08','2026-09-30 23:59+08');
  if (v_result#>>'{summary,revenue}')::numeric<>270 then raise exception 'Expected report revenue of 270'; end if;
  if (v_result#>>'{summary,capitalRecovered}')::numeric<>135 then raise exception 'Expected report capital recovery of 135'; end if;
  v_result:=public.get_business_accounting_report('2026-09-03 00:00+08','2026-09-03 23:59+08');
  if (v_result#>>'{products,0,periodOpeningStock}')::integer<>5 then raise exception 'Expected period opening stock of 5'; end if;
  if (v_result#>>'{products,0,periodClosingStock}')::integer<>29 then raise exception 'Expected period closing stock of 29'; end if;

  begin
    perform public.update_inventory_restock(v_restock,23,'2026-09-03 09:00+08','345','','Supplier A','R-003','Should be locked');
    raise exception 'Expected completed-cycle restock correction to be rejected';
  exception when others then
    if sqlerrm not like 'This restock is locked%' then raise; end if;
  end;
end $$;

select 'business accounting integration test passed' as result;
