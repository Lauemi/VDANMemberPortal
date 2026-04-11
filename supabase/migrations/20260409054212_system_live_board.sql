
-- Live Board: zentraler Statusraum für Claude + Codex
CREATE TABLE IF NOT EXISTS public.system_live_board (
  id          text        PRIMARY KEY,
  domain      text        NOT NULL,
  owner       text        NOT NULL CHECK (owner IN ('claude', 'codex', 'michel')),
  status      text        NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'done', 'blocked')),
  description text        NOT NULL,
  blocking    boolean     NOT NULL DEFAULT false,
  notes       text        DEFAULT null,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- RLS: nur service_role (Claude + Codex via Edge Functions)
ALTER TABLE public.system_live_board ENABLE ROW LEVEL SECURITY;
CREATE POLICY "live_board_service_role_only" ON public.system_live_board
  FOR ALL USING (true) WITH CHECK (true);

-- Trigger: updated_at automatisch setzen
CREATE TRIGGER set_live_board_updated_at
  BEFORE UPDATE ON public.system_live_board
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Initialer Stand — alle aktuell offenen Punkte
INSERT INTO public.system_live_board (id, domain, owner, status, description, blocking, notes) VALUES
  ('work_event_patch',        'domain3', 'codex',  'open',        'work-event-admin-update: counts_toward_quota, approval_required, target_hours ergänzen + deployen', false, 'Felder in DB seit 20260409041435 vorhanden'),
  ('work_approval_flow',      'domain3', 'codex',  'open',        'Approval-Flow: Vorstand setzt status=approved + member_no + quota_year in work_participations', false, 'RPC get_member_work_account ist bereit'),
  ('work_member_view',        'domain3', 'codex',  'open',        'Mitglieder-Zeitkonto-Ansicht anbinden via get_member_work_account()', false, null),
  ('work_summary_view',       'domain3', 'codex',  'open',        'Vorstand-Übersicht anbinden via get_club_work_summary()', false, null),
  ('mail_edge_function',      'domain1', 'codex',  'blocked',     'send-notification Edge Function bauen + Resend anbinden', true, 'Wartet auf Resend-Setup durch Michel'),
  ('mail_invite_queue',       'domain1', 'codex',  'blocked',     'queue_notification_email() aus club-invite-create + club-invite-claim aufrufen', true, 'Wartet auf mail_edge_function'),
  ('repo_sync_pull',          'infra',   'codex',  'open',        'supabase db pull ausführen wenn Docker läuft — neue Migrations-Files erzeugen', false, 'Docker Desktop starten, dann: npx supabase db pull'),
  ('work_hours_confirm',      'domain3', 'michel', 'open',        'Vorstand bestätigt: 8h Standard, Jugend/Ehren befreit?', false, 'Aktuell in DB als Placeholder gesetzt'),
  ('prices_cards',            'billing', 'michel', 'open',        'Preise für Karten eintragen: Innenwasser + Rheinlos je Gruppe', false, 'Aktuell alle price: null'),
  ('resend_setup',            'domain1', 'michel', 'open',        'Resend-Account aufsetzen + API-Key in Supabase Secrets hinterlegen', true,  'Michel macht das heute'),
  ('sql_contract_work_hours', 'kescher', 'codex',  'open',        'SQL-Contract-File anlegen: docs/sql-contracts/.../READ_work_hours_config.sql', false, 'NO_SQL_CONTRACT_REFERENCE im Kescher');
;
