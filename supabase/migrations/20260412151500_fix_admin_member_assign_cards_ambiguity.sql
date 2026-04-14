create or replace function public.admin_member_assign_cards(
  p_club_id uuid,
  p_member_no text,
  p_card_ids jsonb default '[]'::jsonb
)
returns table(
  member_no text,
  card_assignments jsonb,
  fishing_card_type text
)
language plpgsql
security definer
set search_path = public, auth, pg_catalog
as $$
declare
  v_member_no text := nullif(trim(p_member_no), '');
  v_card_ids text[] := array[]::text[];
  v_card_id text;
  v_label text;
  v_membership_id uuid;
begin
  if p_club_id is null then
    raise exception 'club_id_required';
  end if;

  if v_member_no is null then
    raise exception 'member_no_required';
  end if;

  if jsonb_typeof(coalesce(p_card_ids, '[]'::jsonb)) <> 'array' then
    raise exception 'card_ids_must_be_array';
  end if;

  if not (
    public.is_service_role_request()
    or public.is_admin_or_vorstand_in_club(p_club_id)
    or public.is_admin_in_any_club()
  ) then
    raise exception 'forbidden_club_scope';
  end if;

  select
    array_remove(array_agg(distinct lower(trim(value)) order by lower(trim(value))), null)
  into v_card_ids
  from jsonb_array_elements_text(coalesce(p_card_ids, '[]'::jsonb)) as value
  where nullif(trim(value), '') is not null;

  if exists (
    select 1
    from unnest(coalesce(v_card_ids, array[]::text[])) as entry
    where entry not in ('innenwasser', 'rheinlos39')
  ) then
    raise exception 'unsupported_card_id';
  end if;

  delete from public.member_card_assignments as mca
  where mca.club_id = p_club_id
    and mca.member_no = v_member_no;

  foreach v_card_id in array coalesce(v_card_ids, array[]::text[])
  loop
    insert into public.member_card_assignments (
      club_id,
      member_no,
      card_id,
      assigned_by,
      source
    ) values (
      p_club_id,
      v_member_no,
      v_card_id,
      auth.uid(),
      'admin_manual'
    )
    on conflict on constraint uq_member_card_assignments do update
      set updated_at = now(),
          assigned_at = now(),
          assigned_by = auth.uid(),
          source = excluded.source;
  end loop;

  v_label := public.member_card_label_from_ids(v_card_ids);

  update public.club_members as cm
  set fishing_card_type = v_label
  where cm.club_id = p_club_id
    and cm.member_no = v_member_no
  returning cm.canonical_membership_id into v_membership_id;

  update public.members as m
  set fishing_card_type = v_label
  where m.club_id = p_club_id
    and m.membership_number = v_member_no;

  if v_membership_id is not null then
    update public.profiles as p
    set fishing_card_type = v_label
    where p.canonical_membership_id = v_membership_id
      and (p.tenant_id is not null or p.club_id = p_club_id);
  end if;

  return query
  select
    v_member_no,
    public.member_card_assignment_labels_from_ids(v_card_ids),
    v_label;
end;
$$;

grant execute on function public.admin_member_assign_cards(uuid, text, jsonb) to authenticated;

notify pgrst, 'reload schema';
