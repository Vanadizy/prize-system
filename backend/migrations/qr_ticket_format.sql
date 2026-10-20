-- Upgrade an existing contest database for QSN ticket labels, opaque public QR
-- tokens, per-ticket display labels, and the campaign logo. Safe to rerun.

ALTER TABLE public.contestants
    ADD COLUMN IF NOT EXISTS display_label character varying(100),
    ADD COLUMN IF NOT EXISTS qr_url text,
    ADD COLUMN IF NOT EXISTS public_token character varying(64);

UPDATE public.contestants
SET public_token = lower(
    replace(gen_random_uuid()::text, '-', '') ||
    replace(gen_random_uuid()::text, '-', '')
)
WHERE public_token IS NULL OR public_token = '';

ALTER TABLE public.contestants
    ALTER COLUMN public_token SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS contestants_public_token_uq
    ON public.contestants(public_token);

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
