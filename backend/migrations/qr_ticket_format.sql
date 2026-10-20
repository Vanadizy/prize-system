-- Upgrade an existing contest database for QSN ticket labels, public QR URLs,
-- per-ticket display labels, and the campaign logo. Safe to run more than once.

ALTER TABLE public.contestants
    ADD COLUMN IF NOT EXISTS display_label character varying(100),
    ADD COLUMN IF NOT EXISTS qr_url text;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'contestants_qsn_id_range_check'
          AND conrelid = 'public.contestants'::regclass
    ) AND NOT EXISTS (
        SELECT 1 FROM public.contestants WHERE id NOT BETWEEN 1 AND 9999
    ) THEN
        ALTER TABLE public.contestants
            ADD CONSTRAINT contestants_qsn_id_range_check
            CHECK (id BETWEEN 1 AND 9999);
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.branding_settings (
    id smallint PRIMARY KEY CHECK (id = 1),
    logo_data_url text,
    updated_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO public.branding_settings (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;
