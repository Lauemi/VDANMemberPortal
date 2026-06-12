-- After 20260612100000 revoked is_same_club FROM PUBLIC, the anon role
-- could no longer plan can_access_club_content (which references is_same_club
-- in its else-branch). PostgreSQL checks privileges at plan time for inlined
-- SQL functions, so even a branch that never executes for anon caused a
-- "permission denied" → 401 on all public reads of feed_posts, club_events,
-- and work_events.
--
-- SECURITY DEFINER makes the function run as its owner (who has EXECUTE on
-- is_same_club), so callers only need EXECUTE on can_access_club_content
-- itself — which anon has via the default PUBLIC grant.
-- set search_path prevents search_path injection for security definer functions.

create or replace function public.can_access_club_content(p_club_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    case
      when auth.uid() is null
        then p_club_id = public.public_active_club_id()
      else public.is_same_club(p_club_id)
    end
$$;

notify pgrst, 'reload schema';
