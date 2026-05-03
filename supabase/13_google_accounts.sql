-- Tabela de contas Google Ads descobertas automaticamente
CREATE TABLE IF NOT EXISTS google_accounts (
  customer_id TEXT PRIMARY KEY,
  name        TEXT NOT NULL DEFAULT '',
  currency    TEXT NOT NULL DEFAULT 'BRL',
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);
