begin;
create or replace function public.admin_member_assign_card(
  p_club_id uuid,
  p_member_no text,
  p_fishing_card_type text
)
returns void
language plpgsql
security definer
set search_path = public, auth, pg_catalog
as $$
begin
  if p_club_id is null then
    raise exception 'club_id_required';
  end if;

  if nullif(trim(p_member_no), '') is null then
    raise exception 'member_no_required';
  end if;

  if nullif(trim(p_fishing_card_type), '') is null then
    raise exception 'fishing_card_type_required';
  end if;

  if not (
    public.is_service_role_request()
    or public.is_admin_or_vorstand_in_club(p_club_id)
    or public.is_admin_in_any_club()
  ) then
    raise exception 'forbidden_club_scope';
  end if;

  update public.club_members
  set fishing_card_type = p_fishing_card_type
  where club_id = p_club_id
    and member_no = p_member_no;

  update public.members
  set fishing_card_type = p_fishing_card_type
  where club_id = p_club_id
    and membership_number = p_member_no;
end;
$$;
grant execute on function public.admin_member_assign_card(uuid, text, text) to authenticated;
commit;
