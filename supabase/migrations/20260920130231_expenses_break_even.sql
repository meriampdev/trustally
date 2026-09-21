begin;

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references public.locations(id) on delete cascade,
  incurred_on date not null default current_date,
  category text not null,
  description text,
  amount numeric(12,2) not null,
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  constraint expenses_amount_positive check (amount > 0),
  constraint expenses_category_allowed check (
    category in ('Setup', 'Equipment', 'Repairs', 'Supplies', 'Transport', 'Fees', 'Other')
  )
);

create index if not exists expenses_location_date_idx
  on public.expenses(location_id, incurred_on desc, created_at desc)
  where archived_at is null;

alter table public.expenses enable row level security;
revoke all on table public.expenses from public, anon, authenticated;

create or replace function public.expense_to_json(p_expense public.expenses)
returns jsonb
language sql
stable
set search_path = public
as $$
  select jsonb_build_object(
    'id', p_expense.id,
    'locationId', p_expense.location_id,
    'incurredOn', p_expense.incurred_on,
    'category', p_expense.category,
    'description', p_expense.description,
    'amount', p_expense.amount,
    'createdAt', p_expense.created_at,
    'updatedAt', p_expense.updated_at
  );
$$;

create or replace function public.list_expenses(p_location_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.require_location_access(p_location_id, false);
  return (
    select coalesce(jsonb_agg(public.expense_to_json(e) order by e.incurred_on desc, e.created_at desc), '[]'::jsonb)
    from public.expenses e
    where e.location_id = p_location_id
      and e.archived_at is null
  );
end;
$$;

create or replace function public.save_expense(
  p_location_id uuid,
  p_id uuid default null,
  p_incurred_on date default current_date,
  p_category text default 'Other',
  p_description text default null,
  p_amount text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_expense public.expenses%rowtype;
  v_amount numeric(12,2);
begin
  perform public.require_location_access(p_location_id, true);
  v_amount := round(nullif(btrim(coalesce(p_amount, '')), '')::numeric, 2);
  if v_amount is null or v_amount <= 0 then
    raise exception 'Expense amount must be greater than zero.';
  end if;
  if nullif(btrim(coalesce(p_category, '')), '') is null then
    raise exception 'Expense category is required.';
  end if;
  if p_incurred_on is null then
    raise exception 'Expense date is required.';
  end if;
  if p_incurred_on > current_date then
    raise exception 'Expense date cannot be in the future.';
  end if;

  if p_id is null then
    insert into public.expenses(location_id, incurred_on, category, description, amount)
    values (
      p_location_id,
      p_incurred_on,
      btrim(p_category),
      nullif(btrim(coalesce(p_description, '')), ''),
      v_amount
    )
    returning * into v_expense;
  else
    update public.expenses e
    set incurred_on = p_incurred_on,
        category = btrim(p_category),
        description = nullif(btrim(coalesce(p_description, '')), ''),
        amount = v_amount,
        updated_at = now()
    where e.id = p_id
      and e.location_id = p_location_id
      and e.archived_at is null
    returning * into v_expense;
    if not found then raise exception 'Expense not found.'; end if;
  end if;

  return public.expense_to_json(v_expense);
end;
$$;

create or replace function public.archive_expense(p_expense_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_expense public.expenses%rowtype;
begin
  select * into v_expense
  from public.expenses e
  where e.id = p_expense_id and e.archived_at is null
  for update;
  if not found then raise exception 'Expense not found.'; end if;
  perform public.require_location_access(v_expense.location_id, true);

  update public.expenses set archived_at = now(), updated_at = now() where id = p_expense_id;
  return jsonb_build_object('id', p_expense_id, 'archived', true);
end;
$$;

revoke all on function public.expense_to_json(public.expenses) from public, anon;
revoke all on function public.list_expenses(uuid) from public, anon;
revoke all on function public.save_expense(uuid, uuid, date, text, text, text) from public, anon;
revoke all on function public.archive_expense(uuid) from public, anon;
grant execute on function public.list_expenses(uuid) to authenticated;
grant execute on function public.save_expense(uuid, uuid, date, text, text, text) to authenticated;
grant execute on function public.archive_expense(uuid) to authenticated;

notify pgrst, 'reload schema';

commit;
