
-- RPC: Board lesen (für Michel + alle)
CREATE OR REPLACE FUNCTION public.get_live_board()
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
SELECT jsonb_build_object(
  'updated_at', now(),
  'open',    (SELECT count(*) FROM system_live_board WHERE status IN ('open','in_progress','blocked')),
  'blocking',(SELECT count(*) FROM system_live_board WHERE blocking = true AND status != 'done'),
  'items',   (SELECT jsonb_agg(to_jsonb(b) ORDER BY blocking DESC, domain, id)
              FROM system_live_board b WHERE status != 'done')
);
$$;

-- RPC: Status setzen (Claude + Codex)
CREATE OR REPLACE FUNCTION public.set_live_board_status(
  p_id     text,
  p_status text,
  p_notes  text DEFAULT null
)
RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
UPDATE public.system_live_board
SET
  status     = p_status,
  notes      = coalesce(p_notes, notes),
  updated_at = now()
WHERE id = p_id;
$$;
;
