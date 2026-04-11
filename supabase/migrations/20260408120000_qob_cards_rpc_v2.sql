begin;
drop function if exists public.admin_upsert_club_cards(uuid, jsonb);
drop function if exists public.normalize_club_cards(text);
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
  v_title text;
  v_kind text;
  v_id text;
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

  for item in
    select *
    from jsonb_array_elements(parsed)
  loop
    if jsonb_typeof(item) = 'string' then
      v_title := nullif(trim(item #>> '{}'), '');
      v_kind := 'annual';
    elsif jsonb_typeof(item) = 'object' then
      v_title := nullif(trim(item ->> 'title'), '');
      v_kind := coalesce(nullif(trim(item ->> 'kind'), ''), 'annual');
    else
      continue;
    end if;

    if v_title is null then
      continue;
    end if;

    v_id := coalesce(nullif(trim(item ->> 'id'), ''), '');
    if v_id = '' then
      v_id := lower(regexp_replace(v_title, '[^a-zA-Z0-9]+', '_', 'g'));
      v_id := trim(both '_' from v_id);
      if v_id = '' then
        v_id := 'card_' || (jsonb_array_length(result) + 1)::text;
      end if;
    end if;

    if jsonb_typeof(item) = 'object' and jsonb_typeof(item -> 'group_rules') = 'object' then
      result := result || jsonb_build_array(
        jsonb_build_object(
          'id', v_id,
          'title', v_title,
          'kind', case when v_kind in ('annual', 'daily', 'weekly', 'monthly') then v_kind else 'annual' end,
          'is_active', coalesce((item ->> 'is_active')::boolean, true),
          'group_rules', item -> 'group_rules'
        )
      );
    else
      result := result || jsonb_build_array(
        jsonb_build_object(
          'id', v_id,
          'title', v_title,
          'kind', case when v_kind in ('annual', 'daily', 'weekly', 'monthly') then v_kind else 'annual' end,
          'is_active', true,
          'group_rules', jsonb_build_object(
            'standard', jsonb_build_object('label', 'Standard', 'is_default', true, 'price', null),
            'youth', jsonb_build_object('label', 'Jugend', 'is_default', true, 'price', null),
            'honorary', jsonb_build_object('label', 'Ehrenmitglied', 'is_default', true, 'price', null)
          )
        )
      );
    end if;
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
  v_rule_key text;
  v_rule jsonb;
  v_title text;
  v_kind text;
  v_card_id text;
  v_seen_ids jsonb := '{}'::jsonb;
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

    v_card_id := nullif(trim(v_card ->> 'id'), '');
    v_title := nullif(trim(v_card ->> 'title'), '');
    v_kind := coalesce(nullif(trim(v_card ->> 'kind'), ''), 'annual');

    if v_card_id is null then
      raise exception 'card_id_required';
    end if;

    if v_seen_ids ? v_card_id then
      raise exception 'duplicate_card_id:%', v_card_id;
    end if;
    v_seen_ids := v_seen_ids || jsonb_build_object(v_card_id, true);

    if v_title is null then
      raise exception 'card_title_required';
    end if;

    if v_kind not in ('annual', 'daily', 'weekly', 'monthly') then
      raise exception 'card_kind_invalid:%', v_kind;
    end if;

    if jsonb_typeof(v_card -> 'group_rules') <> 'object' then
      raise exception 'group_rules_required';
    end if;

    for v_rule_key, v_rule in
      select key, value
      from jsonb_each(v_card -> 'group_rules')
    loop
      if v_rule_key not in ('standard', 'youth', 'honorary') then
        raise exception 'group_rule_key_invalid:%', v_rule_key;
      end if;

      if jsonb_typeof(v_rule) <> 'object' then
        raise exception 'group_rule_object_required:%', v_rule_key;
      end if;
    end loop;
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
