-- ============================================================
-- TODAS AS FUNCIONALIDADES — Migração Completa
-- Fase 1 (Quick Wins) + Fase 2 (Core) + Fase 3 (Estratégico)
-- Execute no Supabase SQL Editor
-- ============================================================

-- ============================================================
-- FASE 1 — QUICK WINS
-- ============================================================

-- Respostas Rápidas (Canned Responses)
CREATE TABLE IF NOT EXISTS quick_replies (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shortcut   TEXT NOT NULL,
  content    TEXT NOT NULL,
  created_by UUID REFERENCES clients(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_quick_replies_shortcut ON quick_replies(shortcut);

-- Tags
CREATE TABLE IF NOT EXISTS tags (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  color      TEXT NOT NULL DEFAULT '#6366f1',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_tags_name ON tags(LOWER(name));

-- Relação contato ↔ tag
CREATE TABLE IF NOT EXISTS contact_tags (
  contact_id UUID NOT NULL REFERENCES whatsapp_contacts(id) ON DELETE CASCADE,
  tag_id     UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (contact_id, tag_id)
);
CREATE INDEX IF NOT EXISTS idx_contact_tags_tag ON contact_tags(tag_id);

-- Horário de funcionamento por instância
CREATE TABLE IF NOT EXISTS business_hours (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_name TEXT NOT NULL REFERENCES whatsapp_instances(instance_name) ON DELETE CASCADE,
  weekday      SMALLINT NOT NULL CHECK (weekday BETWEEN 0 AND 6), -- 0=Dom, 1=Seg … 6=Sab
  open_time    TIME,
  close_time   TIME,
  is_active    BOOLEAN DEFAULT TRUE,
  UNIQUE (instance_name, weekday)
);

-- Mensagem de ausência por instância
ALTER TABLE whatsapp_instances
  ADD COLUMN IF NOT EXISTS away_message TEXT,
  ADD COLUMN IF NOT EXISTS timezone     TEXT DEFAULT 'America/Sao_Paulo';

-- Notas internas no chat (invisíveis para o cliente)
ALTER TABLE whatsapp_messages
  ADD COLUMN IF NOT EXISTS is_internal BOOLEAN DEFAULT FALSE;

-- Agendamento de mensagens
CREATE TABLE IF NOT EXISTS scheduled_messages (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id    UUID NOT NULL REFERENCES whatsapp_contacts(id) ON DELETE CASCADE,
  instance_name TEXT NOT NULL,
  body          TEXT NOT NULL,
  send_at       TIMESTAMPTZ NOT NULL,
  status        TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sent','failed')),
  sent_at       TIMESTAMPTZ,
  error_msg     TEXT,
  created_by    UUID REFERENCES clients(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_scheduled_messages_pending
  ON scheduled_messages(send_at) WHERE status = 'pending';

-- Notificações in-app
CREATE TABLE IF NOT EXISTS notifications (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  type       TEXT NOT NULL, -- 'new_message' | 'stage_change' | 'mention' | 'sla_warning'
  title      TEXT NOT NULL,
  body       TEXT,
  payload    JSONB,
  read       BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
  ON notifications(user_id, created_at DESC) WHERE read = FALSE;

-- Campos extras em contatos (origem, opt-in, UTM)
ALTER TABLE whatsapp_contacts
  ADD COLUMN IF NOT EXISTS source_url  TEXT,
  ADD COLUMN IF NOT EXISTS opted_in    BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS opted_in_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS opted_out_at TIMESTAMPTZ,
  -- UTM para atribuição de origem (Fase 3)
  ADD COLUMN IF NOT EXISTS utm_source   TEXT,
  ADD COLUMN IF NOT EXISTS utm_medium   TEXT,
  ADD COLUMN IF NOT EXISTS utm_campaign TEXT,
  ADD COLUMN IF NOT EXISTS utm_content  TEXT,
  ADD COLUMN IF NOT EXISTS utm_term     TEXT,
  ADD COLUMN IF NOT EXISTS ad_id        TEXT,
  ADD COLUMN IF NOT EXISTS ad_name      TEXT,
  ADD COLUMN IF NOT EXISTS adset_id     TEXT,
  ADD COLUMN IF NOT EXISTS adset_name   TEXT,
  ADD COLUMN IF NOT EXISTS campaign_id_meta TEXT;

-- ============================================================
-- FASE 2 — CORE DIFERENCIADORES
-- ============================================================

-- Campos customizados por contato
CREATE TABLE IF NOT EXISTS custom_field_definitions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  field_type TEXT NOT NULL CHECK (field_type IN ('text','number','date','select','boolean')),
  options    JSONB, -- para tipo 'select': ["Opção 1","Opção 2"]
  is_active  BOOLEAN DEFAULT TRUE,
  position   INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS custom_field_values (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID NOT NULL REFERENCES whatsapp_contacts(id) ON DELETE CASCADE,
  field_id   UUID NOT NULL REFERENCES custom_field_definitions(id) ON DELETE CASCADE,
  value      TEXT,
  UNIQUE (contact_id, field_id)
);
CREATE INDEX IF NOT EXISTS idx_custom_field_values_contact ON custom_field_values(contact_id);

-- Timeline de eventos do contato (event sourcing)
CREATE TABLE IF NOT EXISTS contact_events (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id   UUID NOT NULL REFERENCES whatsapp_contacts(id) ON DELETE CASCADE,
  event_type   TEXT NOT NULL, -- 'message'|'stage_change'|'note'|'assignment'|'field_update'|'tag_added'|'tag_removed'|'opted_out'|'imported'
  payload      JSONB,
  created_by   UUID REFERENCES clients(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_contact_events_contact ON contact_events(contact_id, created_at DESC);

-- Histórico de mudança de etapa do lead
CREATE TABLE IF NOT EXISTS lead_stage_history (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id       UUID NOT NULL REFERENCES crm_leads(id) ON DELETE CASCADE,
  from_stage_id UUID REFERENCES crm_stages(id) ON DELETE SET NULL,
  to_stage_id   UUID NOT NULL REFERENCES crm_stages(id) ON DELETE CASCADE,
  changed_by    UUID REFERENCES clients(id) ON DELETE SET NULL,
  changed_at    TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_lead_stage_history_lead ON lead_stage_history(lead_id, changed_at DESC);

-- Campos extras em crm_leads
ALTER TABLE crm_leads
  ADD COLUMN IF NOT EXISTS lost_reason TEXT,
  ADD COLUMN IF NOT EXISTS closed_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES clients(id) ON DELETE SET NULL;

-- Transferência de conversa entre agentes
CREATE TABLE IF NOT EXISTS conversation_assignments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id  UUID NOT NULL REFERENCES whatsapp_contacts(id) ON DELETE CASCADE,
  from_agent  UUID REFERENCES clients(id) ON DELETE SET NULL,
  to_agent    UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  note        TEXT,
  assigned_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE whatsapp_contacts
  ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES clients(id) ON DELETE SET NULL;

-- Departamentos
CREATE TABLE IF NOT EXISTS departments (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS department_members (
  department_id UUID NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  PRIMARY KEY (department_id, user_id)
);

ALTER TABLE whatsapp_contacts
  ADD COLUMN IF NOT EXISTS department_id UUID REFERENCES departments(id) ON DELETE SET NULL;

-- Broadcast em massa
CREATE TABLE IF NOT EXISTS broadcast_campaigns (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  body            TEXT NOT NULL,
  instance_name   TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','running','completed','failed','paused')),
  total_recipients INT DEFAULT 0,
  sent_count      INT DEFAULT 0,
  delivered_count INT DEFAULT 0,
  read_count      INT DEFAULT 0,
  replied_count   INT DEFAULT 0,
  failed_count    INT DEFAULT 0,
  created_by      UUID REFERENCES clients(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  started_at      TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS broadcast_recipients (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES broadcast_campaigns(id) ON DELETE CASCADE,
  contact_id  UUID NOT NULL REFERENCES whatsapp_contacts(id) ON DELETE CASCADE,
  status      TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sent','delivered','read','replied','failed')),
  sent_at     TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  read_at     TIMESTAMPTZ,
  replied_at  TIMESTAMPTZ,
  error_msg   TEXT,
  UNIQUE (campaign_id, contact_id)
);
CREATE INDEX IF NOT EXISTS idx_broadcast_recipients_campaign ON broadcast_recipients(campaign_id, status);

-- Sequências de follow-up (régua de cadência)
CREATE TABLE IF NOT EXISTS sequences (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT NOT NULL,
  trigger_event TEXT NOT NULL DEFAULT 'manual', -- 'manual'|'lead_created'|'no_reply_Xh'
  is_active    BOOLEAN DEFAULT TRUE,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sequence_steps (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sequence_id UUID NOT NULL REFERENCES sequences(id) ON DELETE CASCADE,
  position    INT NOT NULL DEFAULT 0,
  delay_hours INT NOT NULL DEFAULT 24,
  body        TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_sequence_steps_sequence ON sequence_steps(sequence_id, position);

CREATE TABLE IF NOT EXISTS sequence_enrollments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sequence_id UUID NOT NULL REFERENCES sequences(id) ON DELETE CASCADE,
  contact_id  UUID NOT NULL REFERENCES whatsapp_contacts(id) ON DELETE CASCADE,
  current_step INT DEFAULT 0,
  status      TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused','completed','cancelled')),
  next_send_at TIMESTAMPTZ,
  enrolled_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (sequence_id, contact_id)
);
CREATE INDEX IF NOT EXISTS idx_sequence_enrollments_next
  ON sequence_enrollments(next_send_at) WHERE status = 'active';

-- CSAT / NPS pós-atendimento
CREATE TABLE IF NOT EXISTS csat_responses (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id  UUID NOT NULL REFERENCES whatsapp_contacts(id) ON DELETE CASCADE,
  agent_id    UUID REFERENCES clients(id) ON DELETE SET NULL,
  score       SMALLINT CHECK (score BETWEEN 1 AND 5),
  comment     TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_csat_responses_agent ON csat_responses(agent_id, created_at DESC);

-- Webhooks de saída configuráveis (Zapier/Make/N8N)
CREATE TABLE IF NOT EXISTS outbound_webhooks (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  event_type TEXT NOT NULL, -- 'new_message'|'stage_change'|'lead_created'|'contact_created'
  url        TEXT NOT NULL,
  secret     TEXT,
  active     BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Opt-in/Opt-out gerenciado
CREATE TABLE IF NOT EXISTS optout_log (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID NOT NULL REFERENCES whatsapp_contacts(id) ON DELETE CASCADE,
  action     TEXT NOT NULL CHECK (action IN ('opt_in','opt_out')),
  source     TEXT, -- 'manual'|'keyword'|'api'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- FASE 3 — DIFERENCIAIS ESTRATÉGICOS
-- ============================================================

-- Flow Builder (chatbot no-code)
CREATE TABLE IF NOT EXISTS flows (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT NOT NULL,
  instance_name TEXT NOT NULL,
  trigger_type  TEXT NOT NULL DEFAULT 'keyword', -- 'keyword'|'first_message'|'lead_created'|'manual'
  trigger_value TEXT, -- palavra-chave que dispara o flow
  is_active    BOOLEAN DEFAULT FALSE,
  created_by   UUID REFERENCES clients(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS flow_nodes (
  id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flow_id  UUID NOT NULL REFERENCES flows(id) ON DELETE CASCADE,
  node_type TEXT NOT NULL, -- 'message'|'condition'|'delay'|'tag'|'assign'|'stage'|'end'
  config   JSONB NOT NULL DEFAULT '{}',
  pos_x    FLOAT DEFAULT 0,
  pos_y    FLOAT DEFAULT 0
);

CREATE TABLE IF NOT EXISTS flow_edges (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flow_id     UUID NOT NULL REFERENCES flows(id) ON DELETE CASCADE,
  from_node   UUID NOT NULL REFERENCES flow_nodes(id) ON DELETE CASCADE,
  to_node     UUID NOT NULL REFERENCES flow_nodes(id) ON DELETE CASCADE,
  condition   JSONB -- null = unconditional; {"type":"contains","value":"sim"} etc.
);

CREATE TABLE IF NOT EXISTS flow_executions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flow_id      UUID NOT NULL REFERENCES flows(id) ON DELETE CASCADE,
  contact_id   UUID NOT NULL REFERENCES whatsapp_contacts(id) ON DELETE CASCADE,
  current_node UUID REFERENCES flow_nodes(id) ON DELETE SET NULL,
  status       TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running','completed','failed','waiting')),
  variables    JSONB DEFAULT '{}',
  started_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_flow_executions_contact ON flow_executions(contact_id) WHERE status = 'running';

-- Agente de IA por instância
CREATE TABLE IF NOT EXISTS ai_agents (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_name TEXT NOT NULL REFERENCES whatsapp_instances(instance_name) ON DELETE CASCADE,
  name          TEXT NOT NULL DEFAULT 'Assistente IA',
  provider      TEXT NOT NULL DEFAULT 'openai', -- 'openai'|'anthropic'
  model         TEXT NOT NULL DEFAULT 'gpt-4o-mini',
  system_prompt TEXT NOT NULL DEFAULT '',
  is_active     BOOLEAN DEFAULT FALSE,
  handoff_keywords TEXT[] DEFAULT ARRAY['humano','atendente','pessoa'],
  temperature   FLOAT DEFAULT 0.7,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (instance_name)
);

CREATE TABLE IF NOT EXISTS ai_conversations (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id    UUID NOT NULL REFERENCES whatsapp_contacts(id) ON DELETE CASCADE,
  agent_id      UUID NOT NULL REFERENCES ai_agents(id) ON DELETE CASCADE,
  status        TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','handed_off','ended')),
  messages      JSONB DEFAULT '[]', -- histórico para o LLM
  started_at    TIMESTAMPTZ DEFAULT NOW(),
  ended_at      TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_ai_conversations_contact ON ai_conversations(contact_id) WHERE status = 'active';

-- Multi-tenant / Organizações
CREATE TABLE IF NOT EXISTS organizations (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  slug       TEXT NOT NULL UNIQUE,
  plan       TEXT NOT NULL DEFAULT 'starter', -- 'starter'|'pro'|'agency'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

-- Integrações externas (HubSpot, RD Station, etc.)
CREATE TABLE IF NOT EXISTS integrations (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider     TEXT NOT NULL, -- 'hubspot'|'rdstation'|'google_sheets'|'n8n'
  name         TEXT NOT NULL,
  config       JSONB NOT NULL DEFAULT '{}', -- API keys, mapping fields
  is_active    BOOLEAN DEFAULT FALSE,
  last_sync_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Log de conversões para Meta/Google (Fase 3 — atribuição)
CREATE TABLE IF NOT EXISTS conversion_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id  UUID NOT NULL REFERENCES whatsapp_contacts(id) ON DELETE CASCADE,
  lead_id     UUID REFERENCES crm_leads(id) ON DELETE SET NULL,
  event_name  TEXT NOT NULL, -- 'Lead'|'Purchase'|'CompleteRegistration'
  value       DECIMAL(12,2),
  currency    TEXT DEFAULT 'BRL',
  sent_to_meta   BOOLEAN DEFAULT FALSE,
  sent_to_google BOOLEAN DEFAULT FALSE,
  meta_event_id  TEXT,
  google_event_id TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_conversion_events_contact ON conversion_events(contact_id);
CREATE INDEX IF NOT EXISTS idx_conversion_events_unsent
  ON conversion_events(created_at) WHERE sent_to_meta = FALSE OR sent_to_google = FALSE;

-- ============================================================
-- ÍNDICES DE PERFORMANCE ADICIONAIS
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_internal
  ON whatsapp_messages(contact_id, timestamp DESC) WHERE is_internal = FALSE;

CREATE INDEX IF NOT EXISTS idx_whatsapp_contacts_assigned
  ON whatsapp_contacts(assigned_to) WHERE assigned_to IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_whatsapp_contacts_opted_in
  ON whatsapp_contacts(opted_in) WHERE opted_in = TRUE;

CREATE INDEX IF NOT EXISTS idx_broadcast_campaigns_status
  ON broadcast_campaigns(status, created_at DESC);

-- Full-text search em mensagens
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_fts
  ON whatsapp_messages USING GIN(to_tsvector('portuguese', COALESCE(body, '')));

-- ============================================================
-- RLS PARA NOVAS TABELAS (admin vê tudo — service_role bypassa)
-- ============================================================

ALTER TABLE quick_replies          ENABLE ROW LEVEL SECURITY;
ALTER TABLE tags                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_tags           ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_hours         ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_messages     ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications          ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_field_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_field_values    ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_events         ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_stage_history     ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE departments            ENABLE ROW LEVEL SECURITY;
ALTER TABLE department_members     ENABLE ROW LEVEL SECURITY;
ALTER TABLE broadcast_campaigns    ENABLE ROW LEVEL SECURITY;
ALTER TABLE broadcast_recipients   ENABLE ROW LEVEL SECURITY;
ALTER TABLE sequences              ENABLE ROW LEVEL SECURITY;
ALTER TABLE sequence_steps         ENABLE ROW LEVEL SECURITY;
ALTER TABLE sequence_enrollments   ENABLE ROW LEVEL SECURITY;
ALTER TABLE csat_responses         ENABLE ROW LEVEL SECURITY;
ALTER TABLE outbound_webhooks      ENABLE ROW LEVEL SECURITY;
ALTER TABLE optout_log             ENABLE ROW LEVEL SECURITY;
ALTER TABLE flows                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE flow_nodes             ENABLE ROW LEVEL SECURITY;
ALTER TABLE flow_edges             ENABLE ROW LEVEL SECURITY;
ALTER TABLE flow_executions        ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_agents              ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_conversations       ENABLE ROW LEVEL SECURITY;
ALTER TABLE organizations          ENABLE ROW LEVEL SECURITY;
ALTER TABLE integrations           ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversion_events      ENABLE ROW LEVEL SECURITY;

-- Políticas admin (service_role key no servidor bypassa automaticamente)
DO $$ DECLARE tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'quick_replies','tags','contact_tags','business_hours','scheduled_messages',
    'notifications','custom_field_definitions','custom_field_values','contact_events',
    'lead_stage_history','conversation_assignments','departments','department_members',
    'broadcast_campaigns','broadcast_recipients','sequences','sequence_steps',
    'sequence_enrollments','csat_responses','outbound_webhooks','optout_log',
    'flows','flow_nodes','flow_edges','flow_executions','ai_agents','ai_conversations',
    'organizations','integrations','conversion_events'
  ] LOOP
    EXECUTE format('DROP POLICY IF EXISTS "admin_all" ON %I', tbl);
    EXECUTE format(
      'CREATE POLICY "admin_all" ON %I FOR ALL USING (
        EXISTS (SELECT 1 FROM clients WHERE id = auth.uid() AND is_admin = TRUE)
      )', tbl
    );
  END LOOP;
END $$;

-- Notificações: usuário vê apenas as suas
DROP POLICY IF EXISTS "own_notifications" ON notifications;
CREATE POLICY "own_notifications" ON notifications FOR SELECT
  USING (user_id = auth.uid());
