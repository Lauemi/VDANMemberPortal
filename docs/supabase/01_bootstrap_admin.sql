-- VDAN Template — bootstrap
-- 1) Create user in Supabase Auth UI (email/password)
-- 2) Then run:

insert into public.user_roles(user_id, role)
values
  ('4ec2ca98-39d7-4cc4-97c7-d3b7af94ebcb', 'admin'),
  ('eb43742c-a803-4473-b7b3-4992fec15603', 'admin')
on conflict (user_id, role) do nothing;

-- Example for vorstand:
-- insert into public.user_roles(user_id, role)
-- values ('<USER_UUID>', 'vorstand')
-- on conflict (user_id, role) do nothing;
