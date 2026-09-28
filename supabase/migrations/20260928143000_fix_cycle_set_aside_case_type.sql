-- Fix the completed-cycle remainingEarnings branch so every CASE result is
-- numeric. The prior wrapper returned jsonb in one branch, causing PostgreSQL
-- error 42804 when an Actual Set Aside record existed.

begin;

do $migration$
declare
  v_definition text;
  v_updated text;
begin
  select pg_get_functiondef('public.get_cycle_set_aside(uuid)'::regprocedure)
  into v_definition;

  v_updated := replace(
    v_definition,
    $old$else v_detail->'remainingEarnings' end$old$,
    $new$else (v_detail->>'remainingEarnings')::numeric end$new$
  );

  if v_updated = v_definition then
    raise exception 'Could not locate the get_cycle_set_aside CASE expression to repair.';
  end if;

  execute v_updated;
end;
$migration$;

notify pgrst, 'reload schema';
commit;
