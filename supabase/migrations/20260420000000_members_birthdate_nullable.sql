-- members.birthdate is optional for CSV imports (German clubs often omit it).
-- The import_csv_confirmed function already handles empty birthdate via NULLIF,
-- but the NOT NULL constraint was blocking inserts. Making it nullable is correct.
ALTER TABLE public.members ALTER COLUMN birthdate DROP NOT NULL;
