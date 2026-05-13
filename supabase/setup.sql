-- ============================================================
-- PROSPECÇÃO OUTBOUND — Nexos Group / Advocacia
-- Rodar no Supabase SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS leads_outbound (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source                  TEXT NOT NULL DEFAULT 'google_maps',
  niche                   TEXT NOT NULL DEFAULT 'advocacia',
  business_name           TEXT NOT NULL,
  category                TEXT,
  city                    TEXT,
  state                   TEXT,
  address                 TEXT,
  phone                   TEXT,
  whatsapp                TEXT,
  email                   TEXT,
  website                 TEXT,
  instagram_handle        TEXT,
  google_rating           NUMERIC(2,1),
  google_reviews_count    INT,
  google_maps_url         TEXT,
  has_website             BOOLEAN DEFAULT NULL,
  has_instagram           BOOLEAN DEFAULT NULL,
  first_message           TEXT,
  message_generated_at    TIMESTAMPTZ,
  status                  TEXT NOT NULL DEFAULT 'new',
  whatsapp_message_id     TEXT,
  sent_at                 TIMESTAMPTZ,
  first_reply_at          TIMESTAMPTZ,
  last_reply_at           TIMESTAMPTZ,
  sdr_history             JSONB DEFAULT '[]',
  qualified_budget        BOOLEAN DEFAULT NULL,
  qualified_urgency       BOOLEAN DEFAULT NULL,
  qualified_decision      BOOLEAN DEFAULT NULL,
  meeting_scheduled_at    TIMESTAMPTZ,
  meeting_link            TEXT,
  next_followup_at        TIMESTAMPTZ,
  followup_count          INT DEFAULT 0,
  raw_data                JSONB,
  created_at              TIMESTAMPTZ DEFAULT now(),
  updated_at              TIMESTAMPTZ DEFAULT now(),
  UNIQUE(phone, niche)
);

CREATE TABLE IF NOT EXISTS leads_outbound_blocked (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone       TEXT UNIQUE NOT NULL,
  reason      TEXT,
  blocked_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_leads_out_status    ON leads_outbound(status);
CREATE INDEX IF NOT EXISTS idx_leads_out_phone     ON leads_outbound(phone);
CREATE INDEX IF NOT EXISTS idx_leads_out_state     ON leads_outbound(state);

ALTER TABLE leads_outbound         DISABLE ROW LEVEL SECURITY;
ALTER TABLE leads_outbound_blocked DISABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION update_leads_outbound_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_leads_outbound_updated_at ON leads_outbound;
CREATE TRIGGER trg_leads_outbound_updated_at
  BEFORE UPDATE ON leads_outbound
  FOR EACH ROW EXECUTE FUNCTION update_leads_outbound_updated_at();

-- Tabela de mensagens pendentes (janela de 45s para agregar bursts)
CREATE TABLE IF NOT EXISTS sdr_pending_messages (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone         TEXT NOT NULL,
  content       TEXT NOT NULL,
  message_type  TEXT DEFAULT 'text',
  is_quiz_lead  BOOLEAN DEFAULT false,
  quiz_data     JSONB DEFAULT '{}',
  processed     BOOLEAN DEFAULT false,
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sdr_pending_phone ON sdr_pending_messages(phone, processed, created_at);
ALTER TABLE sdr_pending_messages DISABLE ROW LEVEL SECURITY;
ALTER TABLE leads_outbound ADD COLUMN IF NOT EXISTS pain_signals TEXT;

-- Confirma
SELECT tablename FROM pg_tables WHERE schemaname = 'public';
