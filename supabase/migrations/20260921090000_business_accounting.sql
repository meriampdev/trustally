begin;

-- Business accounting is additive. Existing cycle reconciliation and Change Float
-- columns/functions remain the source of truth for physical cash.

alter table public.stock_additions
  add column if not exists occurred_at timestamptz,
  add column if not exists supplier text,
  add column if not exists receipt_reference text,
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists voided_at timestamptz;

update public.stock_additions set occurred_at = created_at where occurred_at is null;
alter table public.stock_additions alter column occurred_at set default now();
alter table public.stock_additions alter column occurred_at set not null;

alter table public.stock_addition_items
  add column if not exists total_amount_paid numeric(14,2),
  add column if not exists previous_quantity integer,
  add column if not exists new_quantity integer,
  add column if not exists previous_average_cost numeric(14,4),
  add column if not exists new_weighted_average_cost numeric(14,4),
  add column if not exists notes text,
  add column if not exists cost_quality text not null default 'VERIFIED',
  add column if not exists puresafe_detail jsonb not null default '{}'::jsonb;

update public.stock_addition_items
set total_amount_paid = round(quantity * unit_cost, 2),
    cost_quality = 'ESTIMATED'
where total_amount_paid is null;

alter table public.stock_addition_items alter column total_amount_paid set not null;
alter table public.stock_addition_items
  drop constraint if exists stock_addition_items_cost_quality_check;
alter table public.stock_addition_items
  add constraint stock_addition_items_cost_quality_check
  check (cost_quality in ('VERIFIED', 'ESTIMATED', 'MISSING'));

alter table public.expenses
  add column if not exists expense_type text not null default 'OPERATING',
  add column if not exists product_id uuid references public.products(id) on delete set null,
  add column if not exists stock_addition_item_id uuid references public.stock_addition_items(id) on delete set null,
  add column if not exists affects_inventory_cost boolean not null default false;

alter table public.expenses drop constraint if exists expenses_category_allowed;
alter table public.expenses
  add constraint expenses_category_allowed check (
    category in ('Setup', 'Equipment', 'Repairs', 'Supplies', 'Transport', 'Fees', 'Other', 'Inventory')
  );
alter table public.expenses drop constraint if exists expenses_expense_type_check;
alter table public.expenses
  add constraint expenses_expense_type_check check (expense_type in ('OPERATING', 'RESTOCK'));

create unique index if not exists expenses_stock_addition_item_unique
  on public.expenses(stock_addition_item_id)
  where stock_addition_item_id is not null;

create table if not exists public.product_inventory_accounts (
  product_id uuid primary key references public.products(id) on delete cascade,
  location_id uuid not null references public.locations(id) on delete cascade,
  current_quantity integer not null default 0,
  weighted_average_unit_cost numeric(14,4),
  inventory_value numeric(14,2),
  opening_capital numeric(14,2) not null default 0,
  total_restock_capital numeric(14,2) not null default 0,
  capital_recovered numeric(14,2) not null default 0,
  revenue numeric(14,2) not null default 0,
  gross_profit numeric(14,2) not null default 0,
  first_restock_at timestamptz,
  last_restock_at timestamptz,
  capital_recovered_at timestamptz,
  cash_break_even_at timestamptz,
  data_quality text not null default 'VERIFIED',
  updated_at timestamptz not null default now(),
  check (current_quantity >= 0),
  check (data_quality in ('VERIFIED', 'ESTIMATED', 'MISSING'))
);

create table if not exists public.sale_cost_records (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references public.locations(id) on delete cascade,
  cycle_id uuid not null references public.box_cycles(id) on delete cascade,
  cycle_item_id uuid not null references public.box_cycle_items(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  sold_at timestamptz not null,
  quantity_sold integer not null default 0,
  selling_price numeric(14,2) not null default 0,
  unit_cost_basis numeric(14,4),
  revenue numeric(14,2) not null default 0,
  capital_recovered numeric(14,2),
  gross_profit numeric(14,2),
  cost_quality text not null default 'VERIFIED',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (cycle_item_id),
  check (quantity_sold >= 0),
  check (cost_quality in ('VERIFIED', 'ESTIMATED', 'MISSING'))
);

create table if not exists public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references public.locations(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  occurred_at timestamptz not null,
  movement_type text not null,
  quantity_in integer not null default 0,
  quantity_out integer not null default 0,
  running_quantity integer,
  unit_cost numeric(14,4),
  inventory_value_change numeric(14,2),
  reference_type text,
  reference_id uuid,
  reference text,
  notes text,
  data_quality text not null default 'VERIFIED',
  voided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (quantity_in >= 0 and quantity_out >= 0),
  check (data_quality in ('VERIFIED', 'ESTIMATED', 'MISSING')),
  check (movement_type in ('OPENING', 'RESTOCK', 'SALE', 'ADJUSTMENT', 'DAMAGED', 'MISSING', 'COACH_DEDUCTION', 'OTHER'))
);

create unique index if not exists stock_movements_source_unique
  on public.stock_movements(reference_type, reference_id, product_id)
  where reference_id is not null and voided_at is null;
create index if not exists stock_movements_location_date_idx
  on public.stock_movements(location_id, occurred_at desc);
create index if not exists sale_cost_records_location_date_idx
  on public.sale_cost_records(location_id, sold_at desc);

create table if not exists public.puresafe_cost_settings (
  product_id uuid primary key references public.products(id) on delete cascade,
  bottle_pack_units integer not null default 119 check (bottle_pack_units > 0),
  bottle_pack_cost numeric(14,2) not null default 571 check (bottle_pack_cost >= 0),
  default_pack_count numeric(10,2) not null default 2 check (default_pack_count >= 0),
  water_container_cost numeric(14,2) not null default 25 check (water_container_cost >= 0),
  default_bottles_per_container numeric(10,2) not null default 16 check (default_bottles_per_container > 0),
  cap_seal_per_unit numeric(14,4) not null default 0 check (cap_seal_per_unit >= 0),
  sticker_per_unit numeric(14,4) not null default 0 check (sticker_per_unit >= 0),
  printing_per_unit numeric(14,4) not null default 0 check (printing_per_unit >= 0),
  other_packaging_per_unit numeric(14,4) not null default 0 check (other_packaging_per_unit >= 0),
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

alter table public.product_inventory_accounts enable row level security;
alter table public.sale_cost_records enable row level security;
alter table public.stock_movements enable row level security;
alter table public.puresafe_cost_settings enable row level security;
revoke all on public.product_inventory_accounts, public.sale_cost_records, public.stock_movements, public.puresafe_cost_settings from public, anon, authenticated;

-- Backfill immutable sale-cost records from the cost snapshots already stored on
-- completed cycles. Zero-cost historical rows are explicitly marked missing.
insert into public.sale_cost_records (
  location_id, cycle_id, cycle_item_id, product_id, sold_at, quantity_sold,
  selling_price, unit_cost_basis, revenue, capital_recovered, gross_profit, cost_quality
)
select bc.location_id, bc.id, bci.id, bci.product_id, bc.completed_at,
       bci.units_taken, bci.selling_price_snapshot,
       case when bci.unit_cost_snapshot > 0 then bci.unit_cost_snapshot else null end,
       bci.expected_revenue,
       case when bci.unit_cost_snapshot > 0 then bci.cogs else null end,
       case when bci.unit_cost_snapshot > 0 then bci.gross_profit else null end,
       case when bci.unit_cost_snapshot > 0 then 'ESTIMATED' else 'MISSING' end
from public.box_cycle_items bci
join public.box_cycles bc on bc.id = bci.cycle_id
where bc.status = 'COMPLETED' and bc.completed_at is not null
on conflict (cycle_item_id) do nothing;

-- Backfill product inventory accounts from durable cycle snapshots. Opening
-- capital is inferred only where the stored snapshots permit it, and is marked
-- estimated instead of being presented as a verified purchase.
insert into public.product_inventory_accounts (
  product_id, location_id, current_quantity, weighted_average_unit_cost,
  inventory_value, opening_capital, total_restock_capital, capital_recovered,
  revenue, gross_profit, first_restock_at, last_restock_at, data_quality
)
select p.id,
       p.location_id,
       greatest(coalesce(active_item.available_quantity, latest_item.ending_quantity, 0), 0),
       case when coalesce(active_item.unit_cost_snapshot, latest_item.unit_cost_snapshot, p.default_unit_cost) > 0
         then coalesce(active_item.unit_cost_snapshot, latest_item.unit_cost_snapshot, p.default_unit_cost) else null end,
       case when coalesce(active_item.unit_cost_snapshot, latest_item.unit_cost_snapshot, p.default_unit_cost) > 0
         then round(greatest(coalesce(active_item.available_quantity, latest_item.ending_quantity, 0), 0)
           * coalesce(active_item.unit_cost_snapshot, latest_item.unit_cost_snapshot, p.default_unit_cost), 2) else null end,
       greatest(round(coalesce(sales.capital_recovered, 0)
         + coalesce(greatest(coalesce(active_item.available_quantity, latest_item.ending_quantity, 0), 0)
           * coalesce(active_item.unit_cost_snapshot, latest_item.unit_cost_snapshot, p.default_unit_cost), 0)
         - coalesce(restocks.capital, 0), 2), 0),
       coalesce(restocks.capital, 0),
       coalesce(sales.capital_recovered, 0),
       coalesce(sales.revenue, 0),
       coalesce(sales.gross_profit, 0),
       restocks.first_at,
       restocks.last_at,
       case when coalesce(active_item.unit_cost_snapshot, latest_item.unit_cost_snapshot, p.default_unit_cost) > 0
         then 'ESTIMATED' else 'MISSING' end
from public.products p
left join lateral (
  select bci.* from public.box_cycle_items bci join public.box_cycles bc on bc.id=bci.cycle_id
  where bci.product_id=p.id and bc.status in ('ACTIVE','CHECKING') order by bc.started_at desc limit 1
) active_item on true
left join lateral (
  select bci.* from public.box_cycle_items bci join public.box_cycles bc on bc.id=bci.cycle_id
  where bci.product_id=p.id and bc.status='COMPLETED' order by bc.completed_at desc limit 1
) latest_item on true
left join lateral (
  select sum(scr.capital_recovered) filter (where scr.capital_recovered is not null) capital_recovered,
         sum(scr.revenue) revenue,
         sum(scr.gross_profit) filter (where scr.gross_profit is not null) gross_profit
  from public.sale_cost_records scr where scr.product_id=p.id
) sales on true
left join lateral (
  select sum(sai.total_amount_paid) capital, min(sa.occurred_at) first_at, max(sa.occurred_at) last_at
  from public.stock_addition_items sai join public.stock_additions sa on sa.id=sai.stock_addition_id
  where sai.product_id=p.id and sa.voided_at is null
) restocks on true
on conflict (product_id) do nothing;

insert into public.stock_movements(location_id,product_id,occurred_at,movement_type,quantity_in,running_quantity,unit_cost,
  inventory_value_change,reference_type,reference_id,reference,notes,data_quality)
select p.location_id,p.id,p.created_at,'OPENING',greatest(coalesce(a.current_quantity,0)
  + coalesce((select sum(s.quantity_sold) from public.sale_cost_records s where s.product_id=p.id),0)
  - coalesce((select sum(sai.quantity) from public.stock_addition_items sai join public.stock_additions sa on sa.id=sai.stock_addition_id where sai.product_id=p.id and sa.voided_at is null),0),0),
  null,a.weighted_average_unit_cost,a.opening_capital,'product',p.id,'Initial tracked inventory',
  'Opening stock reconstructed from existing cycle snapshots','ESTIMATED'
from public.products p join public.product_inventory_accounts a on a.product_id=p.id
where a.opening_capital>0
  and not exists(select 1 from public.stock_movements existing where existing.product_id=p.id and existing.movement_type='OPENING' and existing.voided_at is null)
on conflict (reference_type,reference_id,product_id) where reference_id is not null and voided_at is null do nothing;

insert into public.stock_movements(location_id,product_id,occurred_at,movement_type,quantity_in,running_quantity,unit_cost,
  inventory_value_change,reference_type,reference_id,reference,notes,data_quality)
select sa.location_id,sai.product_id,sa.occurred_at,'RESTOCK',sai.quantity,sai.new_quantity,sai.unit_cost,sai.total_amount_paid,
  'stock_addition_item',sai.id,sa.receipt_reference,coalesce(sai.notes,sa.note),'ESTIMATED'
from public.stock_addition_items sai join public.stock_additions sa on sa.id=sai.stock_addition_id
where sa.voided_at is null
on conflict (reference_type,reference_id,product_id) where reference_id is not null and voided_at is null do nothing;

insert into public.stock_movements(location_id,product_id,occurred_at,movement_type,quantity_out,running_quantity,unit_cost,
  inventory_value_change,reference_type,reference_id,reference,data_quality)
select s.location_id,s.product_id,s.sold_at,'SALE',s.quantity_sold,bci.ending_quantity,s.unit_cost_basis,
  case when s.capital_recovered is not null then -s.capital_recovered end,'cycle_item',s.cycle_item_id,'Cycle #'||bc.cycle_number,s.cost_quality
from public.sale_cost_records s join public.box_cycles bc on bc.id=s.cycle_id join public.box_cycle_items bci on bci.id=s.cycle_item_id
on conflict (reference_type,reference_id,product_id) where reference_id is not null and voided_at is null do nothing;

insert into public.stock_movements(location_id,product_id,occurred_at,movement_type,quantity_out,unit_cost,inventory_value_change,
  reference_type,reference_id,reference,notes,data_quality)
select nsr.location_id,nsi.product_id,nsr.created_at,
  case when nsi.reason='DAMAGED' then 'DAMAGED' when nsi.reason in ('OWNER_USE','STAFF_USE') then 'COACH_DEDUCTION' else 'OTHER' end,
  nsi.quantity,nullif(bci.unit_cost_snapshot,0),case when bci.unit_cost_snapshot>0 then -round(nsi.quantity*bci.unit_cost_snapshot,2) end,
  'non_sale_removal_item',nsi.id,nsi.reason::text,nsi.note,case when bci.unit_cost_snapshot>0 then 'ESTIMATED' else 'MISSING' end
from public.non_sale_removal_items nsi join public.non_sale_removals nsr on nsr.id=nsi.non_sale_removal_id
left join public.box_cycle_items bci on bci.cycle_id=nsr.cycle_id and bci.product_id=nsi.product_id
on conflict (reference_type,reference_id,product_id) where reference_id is not null and voided_at is null do nothing;

-- Existing restocks become linked inventory-purchase expenses exactly once.
insert into public.expenses (
  location_id, incurred_on, category, description, amount, created_by,
  expense_type, product_id, stock_addition_item_id, affects_inventory_cost
)
select sa.location_id, (sa.occurred_at at time zone 'Asia/Manila')::date, 'Inventory',
       'Inventory purchase: ' || public.format_product_name(p.name,p.brand,p.variant,p.volume_text,p.unit),
       sai.total_amount_paid, sa.created_by, 'RESTOCK', sai.product_id, sai.id, true
from public.stock_addition_items sai
join public.stock_additions sa on sa.id=sai.stock_addition_id
join public.products p on p.id=sai.product_id
where sa.voided_at is null
on conflict (stock_addition_item_id) where stock_addition_item_id is not null do nothing;

create or replace function public.ensure_inventory_account(p_product_id uuid)
returns public.product_inventory_accounts
language plpgsql security definer set search_path=public
as $$
declare v_product public.products%rowtype; v_item public.box_cycle_items%rowtype; v_result public.product_inventory_accounts%rowtype;
begin
  select * into v_result from public.product_inventory_accounts where product_id=p_product_id for update;
  if found then return v_result; end if;
  select * into v_product from public.products where id=p_product_id;
  if not found then raise exception 'Product not found.'; end if;
  select bci.* into v_item from public.box_cycle_items bci join public.box_cycles bc on bc.id=bci.cycle_id
    where bci.product_id=p_product_id and bc.status in ('ACTIVE','CHECKING') order by bc.started_at desc limit 1;
  insert into public.product_inventory_accounts(product_id,location_id,current_quantity,weighted_average_unit_cost,inventory_value,opening_capital,data_quality)
  values(v_product.id,v_product.location_id,coalesce(v_item.available_quantity,0),
    nullif(coalesce(v_item.unit_cost_snapshot,v_product.default_unit_cost),0),
    case when coalesce(v_item.unit_cost_snapshot,v_product.default_unit_cost)>0 then round(coalesce(v_item.available_quantity,0)*coalesce(v_item.unit_cost_snapshot,v_product.default_unit_cost),2) end,
    coalesce(round(coalesce(v_item.available_quantity,0)*coalesce(v_item.unit_cost_snapshot,v_product.default_unit_cost),2),0),
    case when coalesce(v_item.unit_cost_snapshot,v_product.default_unit_cost)>0 then 'ESTIMATED' else 'MISSING' end)
  returning * into v_result;
  return v_result;
end $$;

create or replace function public.prepare_restock_item()
returns trigger language plpgsql security definer set search_path=public
as $$
declare v_account public.product_inventory_accounts%rowtype; v_total numeric(14,2); v_capital numeric(14,2); v_new_quantity integer; v_new_cost numeric(14,4);
begin
  v_account := public.ensure_inventory_account(new.product_id);
  v_total := coalesce(new.total_amount_paid,round(new.quantity*new.unit_cost,2));
  v_capital := coalesce(v_account.inventory_value,coalesce(v_account.current_quantity*v_account.weighted_average_unit_cost,0));
  v_new_quantity := v_account.current_quantity+new.quantity;
  v_new_cost := case
    when v_account.current_quantity>0 and v_account.inventory_value is null then null
    when v_new_quantity>0 then round((v_capital+v_total)/v_new_quantity,4)
    else null end;
  new.total_amount_paid := v_total;
  new.previous_quantity := v_account.current_quantity;
  new.new_quantity := v_new_quantity;
  new.previous_average_cost := v_account.weighted_average_unit_cost;
  new.new_weighted_average_cost := v_new_cost;
  return new;
end $$;

create or replace function public.record_restock_accounting()
returns trigger language plpgsql security definer set search_path=public
as $$
declare v_header public.stock_additions%rowtype; v_product public.products%rowtype; v_account public.product_inventory_accounts%rowtype;
begin
  select * into v_header from public.stock_additions where id=new.stock_addition_id;
  select * into v_product from public.products where id=new.product_id;
  update public.product_inventory_accounts
  set current_quantity=new.new_quantity,
      weighted_average_unit_cost=new.new_weighted_average_cost,
      inventory_value=case when current_quantity>0 and inventory_value is null then null else round(coalesce(inventory_value,0)+new.total_amount_paid,2) end,
      total_restock_capital=total_restock_capital+new.total_amount_paid,
      first_restock_at=coalesce(first_restock_at,v_header.occurred_at),
      last_restock_at=greatest(coalesce(last_restock_at,v_header.occurred_at),v_header.occurred_at),
      data_quality=case when current_quantity>0 and inventory_value is null then 'MISSING' when data_quality='MISSING' then 'ESTIMATED' else data_quality end,
      updated_at=now()
  where product_id=new.product_id returning * into v_account;
  update public.products set default_unit_cost=round(new.new_weighted_average_cost,2)
    where id=new.product_id and new.new_weighted_average_cost is not null;
  insert into public.expenses(location_id,incurred_on,category,description,amount,created_by,expense_type,product_id,stock_addition_item_id,affects_inventory_cost)
  values(v_header.location_id,(v_header.occurred_at at time zone 'Asia/Manila')::date,'Inventory',
    'Inventory purchase: '||public.format_product_name(v_product.name,v_product.brand,v_product.variant,v_product.volume_text,v_product.unit),
    new.total_amount_paid,v_header.created_by,'RESTOCK',new.product_id,new.id,true)
  on conflict (stock_addition_item_id) where stock_addition_item_id is not null do update
    set amount=excluded.amount,incurred_on=excluded.incurred_on,updated_at=now(),archived_at=null;
  insert into public.stock_movements(location_id,product_id,occurred_at,movement_type,quantity_in,running_quantity,unit_cost,inventory_value_change,reference_type,reference_id,reference,notes,data_quality)
  values(v_header.location_id,new.product_id,v_header.occurred_at,'RESTOCK',new.quantity,new.new_quantity,new.unit_cost,new.total_amount_paid,
    'stock_addition_item',new.id,v_header.receipt_reference,coalesce(new.notes,v_header.note),new.cost_quality)
  on conflict (reference_type,reference_id,product_id) where reference_id is not null and voided_at is null do update
    set occurred_at=excluded.occurred_at,quantity_in=excluded.quantity_in,running_quantity=excluded.running_quantity,unit_cost=excluded.unit_cost,
        inventory_value_change=excluded.inventory_value_change,reference=excluded.reference,notes=excluded.notes,updated_at=now();
  return new;
end $$;

drop trigger if exists prepare_restock_item_trigger on public.stock_addition_items;
create trigger prepare_restock_item_trigger before insert on public.stock_addition_items
for each row execute function public.prepare_restock_item();
drop trigger if exists record_restock_accounting_trigger on public.stock_addition_items;
create trigger record_restock_accounting_trigger after insert on public.stock_addition_items
for each row execute function public.record_restock_accounting();

create or replace function public.sync_cycle_business_accounting(p_cycle_id uuid)
returns void language plpgsql security definer set search_path=public
as $$
declare v_cycle public.box_cycles%rowtype; v_item public.box_cycle_items%rowtype; v_quality text; v_account public.product_inventory_accounts%rowtype;
begin
  select * into v_cycle from public.box_cycles where id=p_cycle_id;
  if not found or v_cycle.status<>'COMPLETED' or v_cycle.completed_at is null then return; end if;
  for v_item in select * from public.box_cycle_items where cycle_id=p_cycle_id loop
    v_quality := case when v_item.unit_cost_snapshot>0 then 'VERIFIED' else 'MISSING' end;
    insert into public.sale_cost_records(location_id,cycle_id,cycle_item_id,product_id,sold_at,quantity_sold,selling_price,unit_cost_basis,revenue,capital_recovered,gross_profit,cost_quality)
    values(v_cycle.location_id,v_cycle.id,v_item.id,v_item.product_id,v_cycle.completed_at,v_item.units_taken,v_item.selling_price_snapshot,
      case when v_item.unit_cost_snapshot>0 then v_item.unit_cost_snapshot end,v_item.expected_revenue,
      case when v_item.unit_cost_snapshot>0 then v_item.cogs end,case when v_item.unit_cost_snapshot>0 then v_item.gross_profit end,v_quality)
    on conflict (cycle_item_id) do update set sold_at=excluded.sold_at,quantity_sold=excluded.quantity_sold,selling_price=excluded.selling_price,
      unit_cost_basis=excluded.unit_cost_basis,revenue=excluded.revenue,capital_recovered=excluded.capital_recovered,gross_profit=excluded.gross_profit,
      cost_quality=excluded.cost_quality,updated_at=now();
    v_account := public.ensure_inventory_account(v_item.product_id);
    update public.product_inventory_accounts a set
      current_quantity=coalesce(v_item.ending_quantity,0),weighted_average_unit_cost=case when v_item.unit_cost_snapshot>0 then v_item.unit_cost_snapshot end,
      inventory_value=case when v_item.unit_cost_snapshot>0 then round(coalesce(v_item.ending_quantity,0)*v_item.unit_cost_snapshot,2) end,
      capital_recovered=coalesce((select sum(s.capital_recovered) from public.sale_cost_records s where s.product_id=v_item.product_id),0),
      revenue=coalesce((select sum(s.revenue) from public.sale_cost_records s where s.product_id=v_item.product_id),0),
      gross_profit=coalesce((select sum(s.gross_profit) from public.sale_cost_records s where s.product_id=v_item.product_id),0),
      capital_recovered_at=case when capital_recovered_at is null and
        coalesce((select sum(s.capital_recovered) from public.sale_cost_records s where s.product_id=v_item.product_id),0)>=opening_capital+total_restock_capital
        then v_cycle.completed_at else capital_recovered_at end,
      cash_break_even_at=case when cash_break_even_at is null and
        coalesce((select sum(s.revenue) from public.sale_cost_records s where s.product_id=v_item.product_id),0)>=opening_capital+total_restock_capital
        then v_cycle.completed_at else cash_break_even_at end,
      updated_at=now() where a.product_id=v_item.product_id;
    insert into public.stock_movements(location_id,product_id,occurred_at,movement_type,quantity_out,running_quantity,unit_cost,inventory_value_change,reference_type,reference_id,reference,data_quality)
    values(v_cycle.location_id,v_item.product_id,v_cycle.completed_at,'SALE',v_item.units_taken,coalesce(v_item.ending_quantity,0),
      case when v_item.unit_cost_snapshot>0 then v_item.unit_cost_snapshot end,
      case when v_item.unit_cost_snapshot>0 then -v_item.cogs end,'cycle_item',v_item.id,'Cycle #'||v_cycle.cycle_number,v_quality)
    on conflict (reference_type,reference_id,product_id) where reference_id is not null and voided_at is null do update
      set occurred_at=excluded.occurred_at,quantity_out=excluded.quantity_out,running_quantity=excluded.running_quantity,unit_cost=excluded.unit_cost,
          inventory_value_change=excluded.inventory_value_change,reference=excluded.reference,data_quality=excluded.data_quality,updated_at=now();
  end loop;
end $$;

create or replace function public.sync_completed_cycle_trigger()
returns trigger language plpgsql security definer set search_path=public as $$
begin perform public.sync_cycle_business_accounting(new.id); return new; end $$;
drop trigger if exists sync_completed_cycle_business on public.box_cycles;
create trigger sync_completed_cycle_business after update on public.box_cycles
for each row when (new.status='COMPLETED') execute function public.sync_completed_cycle_trigger();

create or replace function public.sync_completed_cycle_item_trigger()
returns trigger language plpgsql security definer set search_path=public as $$
begin if exists(select 1 from public.box_cycles where id=new.cycle_id and status='COMPLETED') then perform public.sync_cycle_business_accounting(new.cycle_id); end if; return new; end $$;
drop trigger if exists sync_completed_cycle_item_business on public.box_cycle_items;
create trigger sync_completed_cycle_item_business after update on public.box_cycle_items
for each row execute function public.sync_completed_cycle_item_trigger();

create or replace function public.record_opening_inventory_account()
returns trigger language plpgsql security definer set search_path=public as $$
declare v_location uuid; v_started_at timestamptz;
begin
  if new.starting_quantity<=0 or exists(select 1 from public.product_inventory_accounts where product_id=new.product_id) then return new; end if;
  select location_id,started_at into v_location,v_started_at from public.box_cycles where id=new.cycle_id;
  insert into public.product_inventory_accounts(product_id,location_id,current_quantity,weighted_average_unit_cost,inventory_value,opening_capital,data_quality)
  values(new.product_id,v_location,new.starting_quantity,nullif(new.unit_cost_snapshot,0),
    case when new.unit_cost_snapshot>0 then round(new.starting_quantity*new.unit_cost_snapshot,2) end,
    case when new.unit_cost_snapshot>0 then round(new.starting_quantity*new.unit_cost_snapshot,2) else 0 end,
    case when new.unit_cost_snapshot>0 then 'VERIFIED' else 'MISSING' end)
  on conflict(product_id) do nothing;
  insert into public.stock_movements(location_id,product_id,occurred_at,movement_type,quantity_in,running_quantity,unit_cost,inventory_value_change,reference_type,reference_id,reference,data_quality)
  values(v_location,new.product_id,v_started_at,'OPENING',new.starting_quantity,new.starting_quantity,nullif(new.unit_cost_snapshot,0),
    case when new.unit_cost_snapshot>0 then round(new.starting_quantity*new.unit_cost_snapshot,2) end,'cycle_item_opening',new.id,'Initial tracked inventory',
    case when new.unit_cost_snapshot>0 then 'VERIFIED' else 'MISSING' end)
  on conflict (reference_type,reference_id,product_id) where reference_id is not null and voided_at is null do nothing;
  return new;
end $$;
drop trigger if exists record_opening_inventory_business on public.box_cycle_items;
create trigger record_opening_inventory_business after insert on public.box_cycle_items
for each row execute function public.record_opening_inventory_account();

create or replace function public.record_non_sale_stock_movement()
returns trigger language plpgsql security definer set search_path=public as $$
declare v_header public.non_sale_removals%rowtype; v_item public.box_cycle_items%rowtype;
  v_type text; v_cost numeric(14,4); v_quality text;
begin
  select * into v_header from public.non_sale_removals where id=new.non_sale_removal_id;
  select * into v_item from public.box_cycle_items where cycle_id=v_header.cycle_id and product_id=new.product_id;
  v_type:=case when new.reason='DAMAGED' then 'DAMAGED' when new.reason in ('OWNER_USE','STAFF_USE') then 'COACH_DEDUCTION' else 'OTHER' end;
  v_cost:=nullif(v_item.unit_cost_snapshot,0);
  v_quality:=case when v_cost is null then 'MISSING' else 'VERIFIED' end;
  insert into public.stock_movements(location_id,product_id,occurred_at,movement_type,quantity_out,running_quantity,unit_cost,
    inventory_value_change,reference_type,reference_id,reference,notes,data_quality)
  values(v_header.location_id,new.product_id,v_header.created_at,v_type,new.quantity,null,v_cost,
    case when v_cost is not null then -round(new.quantity*v_cost,2) end,'non_sale_removal_item',new.id,new.reason::text,new.note,v_quality)
  on conflict (reference_type,reference_id,product_id) where reference_id is not null and voided_at is null do update
    set occurred_at=excluded.occurred_at,movement_type=excluded.movement_type,quantity_out=excluded.quantity_out,
        unit_cost=excluded.unit_cost,inventory_value_change=excluded.inventory_value_change,reference=excluded.reference,
        notes=excluded.notes,data_quality=excluded.data_quality,updated_at=now();
  return new;
end $$;
drop trigger if exists record_non_sale_stock_movement_trigger on public.non_sale_removal_items;
create trigger record_non_sale_stock_movement_trigger after insert or update on public.non_sale_removal_items
for each row execute function public.record_non_sale_stock_movement();

create or replace function public.create_inventory_restock(
  p_product_id uuid,p_quantity integer,p_occurred_at timestamptz,p_total_amount_paid text,p_unit_cost_override text,
  p_selling_price text,p_supplier text,p_receipt_reference text,p_notes text,p_puresafe_detail jsonb,p_idempotency_key uuid
) returns jsonb language plpgsql security definer set search_path=public
as $$
declare v_user uuid:=auth.uid(); v_location uuid; v_cycle public.box_cycles%rowtype; v_product public.products%rowtype;
  v_header uuid; v_item public.stock_addition_items%rowtype; v_total numeric(14,2); v_unit numeric(14,4); v_sell numeric(14,2); v_existing jsonb;
begin
  if v_user is null then raise exception 'Authentication required.'; end if;
  select response into v_existing from public.client_mutations where idempotency_key=p_idempotency_key and user_id=v_user and mutation_name='create_inventory_restock';
  if found then return v_existing; end if;
  v_location:=public.require_current_location_id(); perform public.require_location_access(v_location,false);
  select * into v_product from public.products where id=p_product_id and location_id=v_location;
  if not found then raise exception 'Product not found.'; end if;
  select * into v_cycle from public.box_cycles where location_id=v_location and status='ACTIVE' order by started_at desc limit 1;
  if not found then raise exception 'No active cycle to restock.'; end if;
  if coalesce(p_quantity,0)<=0 then raise exception 'Quantity must be greater than zero.'; end if;
  v_total:=round(nullif(btrim(coalesce(p_total_amount_paid,'')),'')::numeric,2);
  if v_total is null or v_total<0 then raise exception 'Total amount paid is required.'; end if;
  v_unit:=coalesce(nullif(btrim(coalesce(p_unit_cost_override,'')),'')::numeric,v_total/p_quantity);
  v_sell:=coalesce(nullif(btrim(coalesce(p_selling_price,'')),'')::numeric,v_product.current_selling_price);
  insert into public.stock_additions(location_id,cycle_id,idempotency_key,note,created_by,occurred_at,supplier,receipt_reference)
  values(v_location,v_cycle.id,p_idempotency_key,nullif(btrim(coalesce(p_notes,'')),''),v_user,coalesce(p_occurred_at,now()),
    nullif(btrim(coalesce(p_supplier,'')),''),nullif(btrim(coalesce(p_receipt_reference,'')),'')) returning id into v_header;
  insert into public.stock_addition_items(stock_addition_id,product_id,quantity,unit_cost,selling_price,total_amount_paid,notes,puresafe_detail)
  values(v_header,p_product_id,p_quantity,round(v_unit,2),v_sell,v_total,nullif(btrim(coalesce(p_notes,'')),''),coalesce(p_puresafe_detail,'{}')) returning * into v_item;
  update public.box_cycle_items set stock_added_quantity=stock_added_quantity+p_quantity,available_quantity=available_quantity+p_quantity,
    unit_cost_snapshot=coalesce(v_item.new_weighted_average_cost,unit_cost_snapshot),selling_price_snapshot=v_sell where cycle_id=v_cycle.id and product_id=p_product_id;
  if not found then
    insert into public.box_cycle_items(cycle_id,product_id,product_name,starting_quantity,stock_added_quantity,available_quantity,unit_cost_snapshot,selling_price_snapshot)
    values(v_cycle.id,p_product_id,public.format_product_name(v_product.name,v_product.brand,v_product.variant,v_product.volume_text,v_product.unit),0,p_quantity,p_quantity,coalesce(v_item.new_weighted_average_cost,0),v_sell);
  end if;
  update public.products set current_selling_price=v_sell where id=p_product_id;
  v_existing:=jsonb_build_object('restockId',v_item.id,'stockAdditionId',v_header,'cycleId',v_cycle.id);
  insert into public.client_mutations(idempotency_key,user_id,mutation_name,response) values(p_idempotency_key,v_user,'create_inventory_restock',v_existing);
  perform public.record_audit_log(v_location,'create','inventory_restock',v_item.id,'{}',to_jsonb(v_item),p_notes);
  return v_existing;
end $$;

create or replace function public.list_inventory_restocks(p_start_at timestamptz default null,p_end_at timestamptz default null)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare v_location uuid;
begin
  v_location:=public.require_current_location_id(); perform public.require_location_access(v_location,false);
  return (select coalesce(jsonb_agg(jsonb_build_object(
    'id',sai.id,'stockAdditionId',sa.id,'cycleId',sa.cycle_id,'cycleNumber',bc.cycle_number,'productId',p.id,
    'productName',public.format_product_name(p.name,p.brand,p.variant,p.volume_text,p.unit),'productCategory',p.category,
    'occurredAt',sa.occurred_at,'quantity',sai.quantity,'previousQuantity',sai.previous_quantity,'newQuantity',sai.new_quantity,
    'previousAverageCost',sai.previous_average_cost,'unitCost',sai.unit_cost,'totalAmountPaid',sai.total_amount_paid,
    'newWeightedAverageCost',sai.new_weighted_average_cost,'supplier',sa.supplier,'receiptReference',sa.receipt_reference,
    'notes',coalesce(sai.notes,sa.note),'puresafeDetail',sai.puresafe_detail,'costQuality',sai.cost_quality,
    'createdBy',coalesce(up.display_name,sa.created_by::text),'editable',bc.status='ACTIVE') order by sa.occurred_at desc),'[]')
    from public.stock_addition_items sai join public.stock_additions sa on sa.id=sai.stock_addition_id
    join public.box_cycles bc on bc.id=sa.cycle_id join public.products p on p.id=sai.product_id
    left join public.user_profiles up on up.user_id=sa.created_by
    where sa.location_id=v_location and sa.voided_at is null and (p_start_at is null or sa.occurred_at>=p_start_at) and (p_end_at is null or sa.occurred_at<=p_end_at));
end $$;

create or replace function public.get_puresafe_cost_settings(p_product_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_product public.products%rowtype; v_settings public.puresafe_cost_settings%rowtype;
begin
  select * into v_product from public.products where id=p_product_id; if not found then raise exception 'Product not found.'; end if;
  perform public.require_location_access(v_product.location_id,false);
  insert into public.puresafe_cost_settings(product_id) values(p_product_id) on conflict do nothing;
  select * into v_settings from public.puresafe_cost_settings where product_id=p_product_id;
  return jsonb_build_object('productId',p_product_id,'bottlePackUnits',v_settings.bottle_pack_units,'bottlePackCost',v_settings.bottle_pack_cost,
    'defaultPackCount',v_settings.default_pack_count,'waterContainerCost',v_settings.water_container_cost,
    'defaultBottlesPerContainer',v_settings.default_bottles_per_container,'capSealPerUnit',v_settings.cap_seal_per_unit,
    'stickerPerUnit',v_settings.sticker_per_unit,'printingPerUnit',v_settings.printing_per_unit,'otherPackagingPerUnit',v_settings.other_packaging_per_unit);
end $$;

create or replace function public.save_puresafe_cost_settings(p_product_id uuid,p_bottle_pack_units integer,p_bottle_pack_cost text,p_default_pack_count text,
  p_water_container_cost text,p_default_bottles_per_container text,p_cap_seal_per_unit text,p_sticker_per_unit text,p_printing_per_unit text,p_other_packaging_per_unit text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_product public.products%rowtype;
begin
  select * into v_product from public.products where id=p_product_id; if not found then raise exception 'Product not found.'; end if;
  perform public.require_location_access(v_product.location_id,true);
  insert into public.puresafe_cost_settings(product_id,bottle_pack_units,bottle_pack_cost,default_pack_count,water_container_cost,default_bottles_per_container,
    cap_seal_per_unit,sticker_per_unit,printing_per_unit,other_packaging_per_unit,updated_by,updated_at)
  values(p_product_id,p_bottle_pack_units,p_bottle_pack_cost::numeric,p_default_pack_count::numeric,p_water_container_cost::numeric,
    p_default_bottles_per_container::numeric,p_cap_seal_per_unit::numeric,p_sticker_per_unit::numeric,p_printing_per_unit::numeric,p_other_packaging_per_unit::numeric,auth.uid(),now())
  on conflict(product_id) do update set bottle_pack_units=excluded.bottle_pack_units,bottle_pack_cost=excluded.bottle_pack_cost,
    default_pack_count=excluded.default_pack_count,water_container_cost=excluded.water_container_cost,default_bottles_per_container=excluded.default_bottles_per_container,
    cap_seal_per_unit=excluded.cap_seal_per_unit,sticker_per_unit=excluded.sticker_per_unit,printing_per_unit=excluded.printing_per_unit,
    other_packaging_per_unit=excluded.other_packaging_per_unit,updated_by=auth.uid(),updated_at=now();
  return public.get_puresafe_cost_settings(p_product_id);
end $$;

create or replace function public.update_inventory_restock(
  p_restock_id uuid,p_quantity integer,p_occurred_at timestamptz,p_total_amount_paid text,p_unit_cost_override text,
  p_supplier text,p_receipt_reference text,p_notes text
) returns jsonb language plpgsql security definer set search_path=public as $$
declare v_item public.stock_addition_items%rowtype; v_previous_item public.stock_addition_items%rowtype; v_header public.stock_additions%rowtype; v_cycle public.box_cycles%rowtype;
  v_account public.product_inventory_accounts%rowtype; v_total numeric(14,2); v_new_quantity integer; v_new_value numeric(14,2); v_new_cost numeric(14,4);
begin
  select * into v_item from public.stock_addition_items where id=p_restock_id for update;
  if not found then raise exception 'Restock not found.'; end if;
  v_previous_item:=v_item;
  select * into v_header from public.stock_additions where id=v_item.stock_addition_id and voided_at is null for update;
  select * into v_cycle from public.box_cycles where id=v_header.cycle_id;
  perform public.require_location_access(v_header.location_id,true);
  if v_cycle.status<>'ACTIVE' then raise exception 'This restock is locked because completed sales depend on its cost basis. Add an adjustment instead.'; end if;
  if exists(select 1 from public.stock_addition_items newer join public.stock_additions n on n.id=newer.stock_addition_id
    where newer.product_id=v_item.product_id and n.voided_at is null and n.occurred_at>v_header.occurred_at) then
    raise exception 'Edit the most recent restock first so weighted-average costs remain reliable.';
  end if;
  if coalesce(p_quantity,0)<=0 then raise exception 'Quantity must be greater than zero.'; end if;
  v_total:=round(nullif(btrim(coalesce(p_total_amount_paid,'')),'')::numeric,2);
  if v_total is null or v_total<0 then raise exception 'Total amount paid is required.'; end if;
  select * into v_account from public.product_inventory_accounts where product_id=v_item.product_id for update;
  if v_account.current_quantity>0 and v_account.inventory_value is null then raise exception 'This restock cannot be recalculated because earlier inventory has missing cost data.'; end if;
  v_new_quantity:=v_account.current_quantity-v_item.quantity+p_quantity;
  v_new_value:=round(coalesce(v_account.inventory_value,0)-v_item.total_amount_paid+v_total,2);
  if v_new_quantity<0 or v_new_value<0 then raise exception 'This correction would create a negative inventory balance.'; end if;
  v_new_cost:=case when v_new_quantity>0 then round(v_new_value/v_new_quantity,4) end;
  update public.stock_additions set occurred_at=coalesce(p_occurred_at,occurred_at),supplier=nullif(btrim(coalesce(p_supplier,'')),''),
    receipt_reference=nullif(btrim(coalesce(p_receipt_reference,'')),''),note=nullif(btrim(coalesce(p_notes,'')),''),updated_at=now() where id=v_header.id;
  update public.stock_addition_items set quantity=p_quantity,total_amount_paid=v_total,
    unit_cost=round(coalesce(nullif(btrim(coalesce(p_unit_cost_override,'')),'')::numeric,v_total/p_quantity),2),
    new_quantity=coalesce(previous_quantity,0)+p_quantity,new_weighted_average_cost=v_new_cost,notes=nullif(btrim(coalesce(p_notes,'')),'' )
  where id=p_restock_id returning * into v_item;
  update public.product_inventory_accounts set current_quantity=v_new_quantity,inventory_value=v_new_value,weighted_average_unit_cost=v_new_cost,
    total_restock_capital=total_restock_capital-v_previous_item.total_amount_paid+v_total,updated_at=now() where product_id=v_item.product_id;
  update public.box_cycle_items set stock_added_quantity=stock_added_quantity+(p_quantity-v_previous_item.quantity),
    available_quantity=available_quantity+(p_quantity-v_previous_item.quantity),unit_cost_snapshot=v_new_cost
    where cycle_id=v_cycle.id and product_id=v_item.product_id;
  update public.products set default_unit_cost=round(v_new_cost,2) where id=v_item.product_id;
  update public.expenses set incurred_on=(coalesce(p_occurred_at,v_header.occurred_at) at time zone 'Asia/Manila')::date,amount=v_total,
    description='Inventory purchase correction',updated_at=now() where stock_addition_item_id=p_restock_id;
  update public.stock_movements set occurred_at=coalesce(p_occurred_at,v_header.occurred_at),quantity_in=p_quantity,running_quantity=v_new_quantity,
    unit_cost=v_item.unit_cost,inventory_value_change=v_total,reference=nullif(btrim(coalesce(p_receipt_reference,'')),''),notes=nullif(btrim(coalesce(p_notes,'')),''),updated_at=now()
    where reference_type='stock_addition_item' and reference_id=p_restock_id and voided_at is null;
  perform public.record_audit_log(v_header.location_id,'update','inventory_restock',p_restock_id,to_jsonb(v_previous_item),
    jsonb_build_object('quantity',p_quantity,'totalAmountPaid',v_total),'Restock correction');
  return jsonb_build_object('restockId',p_restock_id,'updated',true);
end $$;

create or replace function public.archive_inventory_restock(p_restock_id uuid,p_reason text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_item public.stock_addition_items%rowtype; v_header public.stock_additions%rowtype; v_cycle public.box_cycles%rowtype; v_account public.product_inventory_accounts%rowtype;
  v_new_quantity integer; v_new_value numeric(14,2); v_new_cost numeric(14,4);
begin
  if nullif(btrim(coalesce(p_reason,'')),'') is null then raise exception 'A reason is required.'; end if;
  select * into v_item from public.stock_addition_items where id=p_restock_id for update; if not found then raise exception 'Restock not found.'; end if;
  select * into v_header from public.stock_additions where id=v_item.stock_addition_id and voided_at is null for update;
  select * into v_cycle from public.box_cycles where id=v_header.cycle_id;
  perform public.require_location_access(v_header.location_id,true);
  if v_cycle.status<>'ACTIVE' then raise exception 'This restock cannot be removed because completed sales depend on its cost basis.'; end if;
  if (select count(*) from public.stock_addition_items where stock_addition_id=v_header.id)>1 then raise exception 'This grouped historical stock addition cannot be removed here.'; end if;
  if exists(select 1 from public.stock_addition_items newer join public.stock_additions n on n.id=newer.stock_addition_id
    where newer.product_id=v_item.product_id and n.voided_at is null and n.occurred_at>v_header.occurred_at) then
    raise exception 'Remove the most recent restock first so weighted-average costs remain reliable.';
  end if;
  select * into v_account from public.product_inventory_accounts where product_id=v_item.product_id for update;
  v_new_quantity:=v_account.current_quantity-v_item.quantity; v_new_value:=round(coalesce(v_account.inventory_value,0)-v_item.total_amount_paid,2);
  if v_new_quantity<0 or v_new_value<0 then raise exception 'This restock can no longer be removed safely. Add an adjustment instead.'; end if;
  v_new_cost:=case when v_new_quantity>0 then round(v_new_value/v_new_quantity,4) end;
  update public.stock_additions set voided_at=now(),updated_at=now(),note=concat_ws(' · ',note,'Removed: '||btrim(p_reason)) where id=v_header.id;
  update public.product_inventory_accounts set current_quantity=v_new_quantity,inventory_value=v_new_value,weighted_average_unit_cost=v_new_cost,
    total_restock_capital=greatest(total_restock_capital-v_item.total_amount_paid,0),updated_at=now() where product_id=v_item.product_id;
  update public.box_cycle_items set stock_added_quantity=stock_added_quantity-v_item.quantity,available_quantity=available_quantity-v_item.quantity,
    unit_cost_snapshot=coalesce(v_new_cost,unit_cost_snapshot) where cycle_id=v_cycle.id and product_id=v_item.product_id;
  update public.products set default_unit_cost=coalesce(round(v_new_cost,2),default_unit_cost) where id=v_item.product_id;
  update public.expenses set archived_at=now(),updated_at=now() where stock_addition_item_id=p_restock_id;
  update public.stock_movements set voided_at=now(),updated_at=now(),notes=concat_ws(' · ',notes,'Removed: '||btrim(p_reason))
    where reference_type='stock_addition_item' and reference_id=p_restock_id and voided_at is null;
  perform public.record_audit_log(v_header.location_id,'archive','inventory_restock',p_restock_id,to_jsonb(v_item),'{}',p_reason);
  return jsonb_build_object('restockId',p_restock_id,'archived',true);
end $$;

create or replace function public.expense_to_json(p_expense public.expenses)
returns jsonb language sql stable set search_path=public as $$
  select jsonb_build_object('id',p_expense.id,'locationId',p_expense.location_id,'incurredOn',p_expense.incurred_on,
    'category',p_expense.category,'description',p_expense.description,'amount',p_expense.amount,'expenseType',p_expense.expense_type,
    'productId',p_expense.product_id,'restockId',p_expense.stock_addition_item_id,'affectsInventoryCost',p_expense.affects_inventory_cost,
    'createdAt',p_expense.created_at,'updatedAt',p_expense.updated_at);
$$;

create or replace function public.save_expense(p_location_id uuid,p_id uuid default null,p_incurred_on date default current_date,
  p_category text default 'Other',p_description text default null,p_amount text default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_expense public.expenses%rowtype; v_amount numeric(12,2);
begin
  perform public.require_location_access(p_location_id,true);
  v_amount:=round(nullif(btrim(coalesce(p_amount,'')),'')::numeric,2);
  if v_amount is null or v_amount<=0 then raise exception 'Expense amount must be greater than zero.'; end if;
  if p_incurred_on is null or p_incurred_on>current_date then raise exception 'Enter a valid expense date.'; end if;
  if p_category='Inventory' then raise exception 'Inventory expenses are created automatically from restocks.'; end if;
  if p_id is null then
    insert into public.expenses(location_id,incurred_on,category,description,amount,expense_type,affects_inventory_cost)
    values(p_location_id,p_incurred_on,p_category,nullif(btrim(coalesce(p_description,'')),''),v_amount,'OPERATING',false) returning * into v_expense;
  else
    if exists(select 1 from public.expenses where id=p_id and stock_addition_item_id is not null) then raise exception 'Edit this purchase from Restock history.'; end if;
    update public.expenses set incurred_on=p_incurred_on,category=p_category,description=nullif(btrim(coalesce(p_description,'')),''),amount=v_amount,updated_at=now()
      where id=p_id and location_id=p_location_id and archived_at is null returning * into v_expense;
    if not found then raise exception 'Expense not found.'; end if;
  end if;
  return public.expense_to_json(v_expense);
end $$;

create or replace function public.archive_expense(p_expense_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_expense public.expenses%rowtype;
begin
  select * into v_expense from public.expenses where id=p_expense_id and archived_at is null for update;
  if not found then raise exception 'Expense not found.'; end if; perform public.require_location_access(v_expense.location_id,true);
  if v_expense.stock_addition_item_id is not null then raise exception 'Remove this purchase from Restock history.'; end if;
  update public.expenses set archived_at=now(),updated_at=now() where id=p_expense_id;
  return jsonb_build_object('id',p_expense_id,'archived',true);
end $$;

create or replace function public.get_business_accounting_report(p_start_at timestamptz default null,p_end_at timestamptz default null)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare v_location uuid; v_start timestamptz:=coalesce(p_start_at,'1900-01-01'::timestamptz); v_end timestamptz:=coalesce(p_end_at,now());
  v_result jsonb;
begin
  v_location:=public.require_current_location_id(); perform public.require_location_access(v_location,false);
  select jsonb_build_object(
    'summary',jsonb_build_object(
      'revenue',coalesce((select sum(revenue) from public.sale_cost_records where location_id=v_location and sold_at between v_start and v_end),0),
      'capitalInvested',coalesce((select sum(sai.total_amount_paid) from public.stock_addition_items sai join public.stock_additions sa on sa.id=sai.stock_addition_id where sa.location_id=v_location and sa.voided_at is null and sa.occurred_at between v_start and v_end),0),
      'capitalRecovered',(select case when count(*) filter(where cost_quality='MISSING')>0 then null else coalesce(sum(capital_recovered),0) end from public.sale_cost_records where location_id=v_location and sold_at between v_start and v_end),
      'capitalStillInStock',(select case when count(*) filter(where inventory_value is null)>0 then null else coalesce(sum(inventory_value),0) end from public.product_inventory_accounts where location_id=v_location),
      'grossProfit',(select case when count(*) filter(where cost_quality='MISSING')>0 then null else coalesce(sum(gross_profit),0) end from public.sale_cost_records where location_id=v_location and sold_at between v_start and v_end),
      'operatingExpenses',coalesce((select sum(amount) from public.expenses where location_id=v_location and archived_at is null and affects_inventory_cost=false and incurred_on between (v_start at time zone 'Asia/Manila')::date and (v_end at time zone 'Asia/Manila')::date),0),
      'restockCount',(select count(*) from public.stock_additions where location_id=v_location and voided_at is null and occurred_at between v_start and v_end),
      'unitsSold',coalesce((select sum(quantity_sold) from public.sale_cost_records where location_id=v_location and sold_at between v_start and v_end),0),
      'inventoryValue',(select case when count(*) filter(where inventory_value is null)>0 then null else coalesce(sum(inventory_value),0) end from public.product_inventory_accounts where location_id=v_location),
      'missingCostSales',(select count(*) from public.sale_cost_records where location_id=v_location and sold_at between v_start and v_end and cost_quality='MISSING')
    ),
    'products',(select coalesce(jsonb_agg(jsonb_build_object(
      'productId',p.id,'productName',public.format_product_name(p.name,p.brand,p.variant,p.volume_text,p.unit),'category',p.category,
      'currentStock',coalesce(a.current_quantity,0),'weightedAverageUnitCost',a.weighted_average_unit_cost,'inventoryValue',a.inventory_value,
      'openingCapital',coalesce(a.opening_capital,0),'totalRestockCapital',coalesce(a.total_restock_capital,0),'capitalInvested',coalesce(a.opening_capital,0)+coalesce(a.total_restock_capital,0),
      'capitalRecovered',coalesce(a.capital_recovered,0),'capitalRemaining',a.inventory_value,
      'recoveryPercentage',case when coalesce(a.opening_capital,0)+coalesce(a.total_restock_capital,0)>0 then round(coalesce(a.capital_recovered,0)/(coalesce(a.opening_capital,0)+coalesce(a.total_restock_capital,0))*100,2) end,
      'revenue',coalesce(a.revenue,0),'grossProfit',coalesce(a.gross_profit,0),'capitalRecoveredAt',a.capital_recovered_at,'cashBreakEvenAt',a.cash_break_even_at,
      'firstRestockAt',a.first_restock_at,'lastRestockAt',a.last_restock_at,'dataQuality',coalesce(a.data_quality,'MISSING'),
      'periodRestocked',coalesce(pr.qty,0),
      'periodOpeningStock',greatest(coalesce(a.current_quantity,0)-coalesce((select sum(m.quantity_in-m.quantity_out) from public.stock_movements m where m.product_id=p.id and m.voided_at is null and m.occurred_at>=v_start),0),0),
      'periodClosingStock',greatest(coalesce(a.current_quantity,0)-coalesce((select sum(m.quantity_in-m.quantity_out) from public.stock_movements m where m.product_id=p.id and m.voided_at is null and m.occurred_at>v_end),0),0),
      'periodRestockCapital',coalesce(pr.capital,0),'periodUnitsSold',coalesce(ps.qty,0),
      'periodRevenue',coalesce(ps.revenue,0),'periodCapitalRecovered',ps.cogs,'periodGrossProfit',ps.profit
    ) order by public.format_product_name(p.name,p.brand,p.variant,p.volume_text,p.unit)),'[]')
      from public.products p left join public.product_inventory_accounts a on a.product_id=p.id
      left join lateral(select sum(sai.quantity) qty,sum(sai.total_amount_paid) capital from public.stock_addition_items sai join public.stock_additions sa on sa.id=sai.stock_addition_id where sai.product_id=p.id and sa.voided_at is null and sa.occurred_at between v_start and v_end) pr on true
      left join lateral(select sum(quantity_sold) qty,sum(revenue) revenue,case when count(*) filter(where cost_quality='MISSING')>0 then null else sum(capital_recovered) end cogs,case when count(*) filter(where cost_quality='MISSING')>0 then null else sum(gross_profit) end profit from public.sale_cost_records where product_id=p.id and sold_at between v_start and v_end) ps on true
      where p.location_id=v_location),
    'sales',(select coalesce(jsonb_agg(jsonb_build_object('id',s.id,'soldAt',s.sold_at,'cycleId',s.cycle_id,'cycleNumber',bc.cycle_number,
      'productId',s.product_id,'productName',bci.product_name,'productCategory',p.category,'quantitySold',s.quantity_sold,'sellingPrice',s.selling_price,
      'revenue',s.revenue,'unitCostUsed',s.unit_cost_basis,'capitalRecovered',s.capital_recovered,'grossProfit',s.gross_profit,
      'grossMargin',case when s.revenue>0 and s.gross_profit is not null then round(s.gross_profit/s.revenue*100,2) end,'paymentMethod',null,'costQuality',s.cost_quality) order by s.sold_at desc),'[]')
      from public.sale_cost_records s join public.box_cycles bc on bc.id=s.cycle_id join public.box_cycle_items bci on bci.id=s.cycle_item_id join public.products p on p.id=s.product_id
      where s.location_id=v_location and s.sold_at between v_start and v_end),
    'restocks',(select public.list_inventory_restocks(v_start,v_end)),
    'expenses',(select coalesce(jsonb_agg(public.expense_to_json(e) order by e.incurred_on desc,e.created_at desc),'[]') from public.expenses e where e.location_id=v_location and e.archived_at is null and e.incurred_on between (v_start at time zone 'Asia/Manila')::date and (v_end at time zone 'Asia/Manila')::date),
    'cycles',(select coalesce(jsonb_agg(jsonb_build_object('cycleId',bc.id,'cycleNumber',bc.cycle_number,'startedAt',bc.started_at,'completedAt',bc.completed_at,
      'expectedSales',bc.expected_revenue,'actualCollections',bc.total_payments_received,'cashCollected',bc.cash_generated,'digitalPayments',coalesce(bc.gcash_collected,0)+coalesce(bc.maya_collected,0)+coalesce(bc.retroactive_online_payment_amount,0),
      'changeFloat',bc.opening_change_float,'closingChangeFloat',bc.cash_returned_amount,'difference',bc.difference_amount,'capitalRecovered',bc.cogs,'grossProfit',bc.gross_profit,
      'otherExpenses',coalesce(ce.expenses,0),'netProfit',case when bc.gross_profit is not null then bc.gross_profit-coalesce(ce.expenses,0) end) order by bc.completed_at desc),'[]')
      from public.box_cycles bc left join lateral(select sum(e.amount) expenses from public.expenses e where e.location_id=bc.location_id and e.archived_at is null and e.affects_inventory_cost=false and e.incurred_on between (bc.started_at at time zone 'Asia/Manila')::date and (bc.completed_at at time zone 'Asia/Manila')::date) ce on true
      where bc.location_id=v_location and bc.status='COMPLETED' and bc.completed_at between v_start and v_end),
    'movements',(select coalesce(jsonb_agg(jsonb_build_object('id',m.id,'occurredAt',m.occurred_at,'productId',m.product_id,
      'productName',public.format_product_name(p.name,p.brand,p.variant,p.volume_text,p.unit),'productCategory',p.category,'movementType',m.movement_type,
      'quantityIn',m.quantity_in,'quantityOut',m.quantity_out,'runningStockBalance',m.running_quantity,'unitCost',m.unit_cost,
      'inventoryValueChange',m.inventory_value_change,'reference',m.reference,'notes',m.notes,'dataQuality',m.data_quality) order by m.occurred_at desc),'[]')
      from public.stock_movements m join public.products p on p.id=m.product_id where m.location_id=v_location and m.voided_at is null and m.occurred_at between v_start and v_end),
    'trend',(select coalesce(jsonb_agg(jsonb_build_object('label',d.trend_day,'revenue',coalesce(s.revenue,0),'grossProfit',s.profit,'capitalInvested',coalesce(r.capital,0),'capitalRecovered',s.cogs) order by d.trend_day),'[]')
      from (select date_trunc('day',sold_at) as trend_day from public.sale_cost_records where location_id=v_location and sold_at between v_start and v_end
            union select date_trunc('day',occurred_at) as trend_day from public.stock_additions where location_id=v_location and voided_at is null and occurred_at between v_start and v_end) d
      left join lateral(select sum(revenue) revenue,case when count(*) filter(where cost_quality='MISSING')>0 then null else sum(gross_profit) end profit,case when count(*) filter(where cost_quality='MISSING')>0 then null else sum(capital_recovered) end cogs from public.sale_cost_records where location_id=v_location and sold_at>=d.trend_day and sold_at<d.trend_day+interval '1 day') s on true
      left join lateral(select sum(sai.total_amount_paid) capital from public.stock_addition_items sai join public.stock_additions sa on sa.id=sai.stock_addition_id where sa.location_id=v_location and sa.voided_at is null and sa.occurred_at>=d.trend_day and sa.occurred_at<d.trend_day+interval '1 day') r on true)
  ) into v_result;
  return v_result;
end $$;

revoke all on function public.ensure_inventory_account(uuid) from public,anon,authenticated;
revoke all on function public.sync_cycle_business_accounting(uuid) from public,anon,authenticated;
revoke all on function public.create_inventory_restock(uuid,integer,timestamptz,text,text,text,text,text,text,jsonb,uuid) from public,anon;
revoke all on function public.list_inventory_restocks(timestamptz,timestamptz) from public,anon;
revoke all on function public.update_inventory_restock(uuid,integer,timestamptz,text,text,text,text,text) from public,anon;
revoke all on function public.archive_inventory_restock(uuid,text) from public,anon;
revoke all on function public.get_puresafe_cost_settings(uuid) from public,anon;
revoke all on function public.save_puresafe_cost_settings(uuid,integer,text,text,text,text,text,text,text,text) from public,anon;
revoke all on function public.get_business_accounting_report(timestamptz,timestamptz) from public,anon;
grant execute on function public.create_inventory_restock(uuid,integer,timestamptz,text,text,text,text,text,text,jsonb,uuid) to authenticated;
grant execute on function public.list_inventory_restocks(timestamptz,timestamptz) to authenticated;
grant execute on function public.update_inventory_restock(uuid,integer,timestamptz,text,text,text,text,text) to authenticated;
grant execute on function public.archive_inventory_restock(uuid,text) to authenticated;
grant execute on function public.get_puresafe_cost_settings(uuid) to authenticated;
grant execute on function public.save_puresafe_cost_settings(uuid,integer,text,text,text,text,text,text,text,text) to authenticated;
grant execute on function public.get_business_accounting_report(timestamptz,timestamptz) to authenticated;

notify pgrst,'reload schema';

commit;
