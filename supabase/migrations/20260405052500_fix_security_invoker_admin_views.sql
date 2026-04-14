begin;
alter view if exists public.admin_member_cards_overview_v
  set (security_invoker = true);
do $$
begin
  if exists (
    select 1
    from pg_views
    where schemaname = 'public'
      and viewname = 'admin_card_claims_overview'
  ) then
    execute 'alter view public.admin_card_claims_overview set (security_invoker = true)';
  end if;
end
$$;
commit;
