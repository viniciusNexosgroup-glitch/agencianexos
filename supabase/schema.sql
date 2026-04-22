-- ============================================================
-- Meta Ads Dashboard — Schema Supabase
-- Execute no SQL Editor do seu projeto Supabase
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ------------------------------------------------------------
-- TABELAS
-- ------------------------------------------------------------

-- Clientes (espelha auth.users)
CREATE TABLE IF NOT EXISTS clients (
  id          UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  name        TEXT NOT NULL,
  email       TEXT NOT NULL UNIQUE,
  is_admin    BOOLEAN DEFAULT FALSE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Contas de anuncio vinculadas a cada cliente
CREATE TABLE IF NOT EXISTS client_accounts (
  id             UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id      UUID REFERENCES clients(id) ON DELETE CASCADE NOT NULL,
  ad_account_id  TEXT NOT NULL,
  account_name   TEXT,
  bm_id          TEXT,
  bm_name        TEXT,
  is_active      BOOLEAN DEFAULT TRUE,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(client_id, ad_account_id)
);

-- Metricas diarias por campanha (sincronizadas da Meta API)
CREATE TABLE IF NOT EXISTS campaign_metrics (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  ad_account_id   TEXT NOT NULL,
  campaign_id     TEXT NOT NULL,
  campaign_name   TEXT,
  metric_date     DATE NOT NULL,
  impressions     BIGINT DEFAULT 0,
  reach           BIGINT DEFAULT 0,
  clicks          BIGINT DEFAULT 0,
  spend           DECIMAL(12,2) DEFAULT 0,
  ctr             DECIMAL(8,4) DEFAULT 0,
  cpc             DECIMAL(10,2),
  cpm             DECIMAL(10,2),
  purchases       INTEGER DEFAULT 0,
  purchase_value  DECIMAL(12,2) DEFAULT 0,
  leads           INTEGER DEFAULT 0,
  checkouts       INTEGER DEFAULT 0,
  frequency       DECIMAL(6,2) DEFAULT 0,
  synced_at       TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(campaign_id, metric_date)
);

-- Historico de sincronizacoes
CREATE TABLE IF NOT EXISTS sync_logs (
  id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  ad_account_id     TEXT NOT NULL,
  status            TEXT NOT NULL CHECK (status IN ('success', 'error', 'partial')),
  campaigns_synced  INTEGER DEFAULT 0,
  date_from         DATE,
  date_to           DATE,
  error_message     TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------
-- ROW LEVEL SECURITY
-- ------------------------------------------------------------

ALTER TABLE clients          ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_accounts  ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_logs        ENABLE ROW LEVEL SECURITY;

-- clients: cada um ve o proprio perfil; admin ve tudo
CREATE POLICY "clients_select_own" ON clients
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "clients_admin_all" ON clients
  FOR ALL USING (
    EXISTS (SELECT 1 FROM clients WHERE id = auth.uid() AND is_admin = TRUE)
  );

-- client_accounts: cliente ve as proprias; admin ve tudo
CREATE POLICY "client_accounts_select_own" ON client_accounts
  FOR SELECT USING (auth.uid() = client_id);

CREATE POLICY "client_accounts_admin_all" ON client_accounts
  FOR ALL USING (
    EXISTS (SELECT 1 FROM clients WHERE id = auth.uid() AND is_admin = TRUE)
  );

-- campaign_metrics: cliente ve apenas das suas contas; admin ve tudo
CREATE POLICY "campaign_metrics_select_own" ON campaign_metrics
  FOR SELECT USING (
    ad_account_id IN (
      SELECT ad_account_id FROM client_accounts
      WHERE client_id = auth.uid() AND is_active = TRUE
    )
  );

CREATE POLICY "campaign_metrics_admin_all" ON campaign_metrics
  FOR ALL USING (
    EXISTS (SELECT 1 FROM clients WHERE id = auth.uid() AND is_admin = TRUE)
  );

-- sync_logs: apenas admin
CREATE POLICY "sync_logs_admin_all" ON sync_logs
  FOR ALL USING (
    EXISTS (SELECT 1 FROM clients WHERE id = auth.uid() AND is_admin = TRUE)
  );

-- ------------------------------------------------------------
-- TRIGGER: cria perfil em clients ao cadastrar usuario
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO clients (id, name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.email
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ------------------------------------------------------------
-- INDEXES para performance
-- ------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_campaign_metrics_account_date
  ON campaign_metrics(ad_account_id, metric_date);

CREATE INDEX IF NOT EXISTS idx_campaign_metrics_campaign_date
  ON campaign_metrics(campaign_id, metric_date);

CREATE INDEX IF NOT EXISTS idx_client_accounts_client
  ON client_accounts(client_id);

-- ------------------------------------------------------------
-- PASSO FINAL: torne voce admin
-- Execute este UPDATE apos criar sua conta no dashboard:
-- UPDATE clients SET is_admin = TRUE WHERE email = 'viniguisan@gmail.com';
-- ------------------------------------------------------------
