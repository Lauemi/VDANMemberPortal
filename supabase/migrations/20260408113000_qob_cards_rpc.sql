begin;
create or replace function public.normalize_club_cards(raw_value text)
returns jsonb
language plpgsql
stable
set search_path = public, pg_catalog
as $$
declare
  parsed jsonb;
  item jsonb;
  result jsonb := '[]'::jsonb;
begin
  if raw_value is null or trim(raw_value) = '' then
    return '[]'::jsonb;
  end if;

  begin
    parsed := raw_value::jsonb;
  exception
    when others then
      return '[]'::jsonb;
  end;

  if jsonb_typeof(parsed) <> 'array' then
    return '[]'::jsonb;
  end if;

  if jsonb_array_length(parsed) = 0 then
    return parsed;
  end if;

  if jsonb_typeof(parsed -> 0) = 'object' then
    return parsed;
  end if;

  for item in
    select *
    from jsonb_array_elements(parsed)
  loop
    result := result || jsonb_build_array(
      jsonb_build_object(
        'title', item #>> '{}',
        'kind', 'annual',
        'member_group_key', 'standard',
        'is_default', true
      )
    );
  end loop;

  return result;
end;
$$;
create or replace function public.admin_upsert_club_cards(
  p_club_id uuid,
  p_cards jsonb
)
returns void
language plpgsql
security definer
set search_path = public, auth, pg_catalog
as $$
declare
  v_card jsonb;
  v_seen_groups jsonb := '{}'::jsonb;
  v_group text;
  v_title text;
  v_kind text;
  v_is_default boolean;
begin
  if p_club_id is null then
    raise exception 'club_id_required';
  end if;

  if not (
    public.is_admin_or_vorstand_in_club(p_club_id)
    or public.is_admin_in_any_club()
    or public.is_service_role_request()
  ) then
    raise exception 'forbidden_club_scope';
  end if;

  if jsonb_typeof(p_cards) <> 'array' then
    raise exception 'cards_must_be_array';
  end if;

  for v_card in
    select *
    from jsonb_array_elements(p_cards)
  loop
    if jsonb_typeof(v_card) <> 'object' then
      raise exception 'card_must_be_object';
    end if;

    v_title := nullif(trim(v_card ->> 'title'), '');
    v_kind := coalesce(nullif(trim(v_card ->> 'kind'), ''), 'annual');
    v_group := coalesce(nullif(trim(v_card ->> 'member_group_key'), ''), '');
    v_is_default := coalesce((v_card ->> 'is_default')::boolean, false);

    if v_title is null then
      raise exception 'card_title_required';
    end if;

    if v_kind not in ('annual', 'daily', 'weekly', 'monthly') then
      raise exception 'card_kind_invalid:%', v_kind;
    end if;

    if v_group not in ('standard', 'youth', 'honorary') then
      raise exception 'member_group_key_invalid:%', v_group;
    end if;

    if v_is_default then
      if v_seen_groups ? v_group then
        raise exception 'duplicate_default_for_group:%', v_group;
      end if;
      v_seen_groups := v_seen_groups || jsonb_build_object(v_group, true);
    end if;
  end loop;

  insert into public.app_secure_settings (setting_key, setting_value, updated_at)
  values (
    'club_cards:' || p_club_id::text,
    p_cards::text,
    now()
  )
  on conflict (setting_key) do update
    set setting_value = excluded.setting_value,
        updated_at = now();
end;
$$;
grant execute on function public.normalize_club_cards(text) to authenticated;
grant execute on function public.admin_upsert_club_cards(uuid, jsonb) to authenticated;
commit;
