-- ============================================================
-- CRM WhatsApp — Correções Críticas de Banco de Dados
-- Execute no Supabase SQL Editor ANTES do próximo deploy
-- ============================================================

-- ============================================================
-- BD-1: COLUNAS FALTANTES
-- ============================================================

ALTER TABLE whatsapp_instances
  ADD COLUMN IF NOT EXISTS qr_base64 TEXT;

ALTER TABLE whatsapp_messages
  ADD COLUMN IF NOT EXISTS participant_name TEXT,
  ADD COLUMN IF NOT EXISTS participant_jid  TEXT;

ALTER TABLE crm_leads
  ADD COLUMN IF NOT EXISTS value DECIMAL(12,2) DEFAULT 0;

-- ============================================================
-- BD-2: ÍNDICES DE PERFORMANCE
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_whatsapp_contacts_instance_phone
  ON whatsapp_contacts(instance_name, phone) INCLUDE (id, name);

CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_contact_timestamp
  ON whatsapp_messages(contact_id, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_participant
  ON whatsapp_messages(instance_name, participant_jid)
  WHERE participant_jid IS NOT NULL;

DROP INDEX IF EXISTS idx_crm_leads_stage;
CREATE INDEX IF NOT EXISTS idx_crm_leads_stage_position
  ON crm_leads(stage_id, position DESC) INCLUDE (id, title, value);

CREATE INDEX IF NOT EXISTS idx_whatsapp_instances_name_status
  ON whatsapp_instances(instance_name, status) INCLUDE (qr_base64);

-- ============================================================
-- BD-3: FUNÇÃO ATÔMICA PARA PROCESSAR MENSAGENS (sem N+1, com transação)
-- ============================================================

CREATE OR REPLACE FUNCTION process_whatsapp_message(
  p_instance_name  TEXT,
  p_phone          TEXT,
  p_message_id     TEXT,
  p_contact_name   TEXT,
  p_remote_jid     TEXT,
  p_body           TEXT,
  p_from_me        BOOLEAN,
  p_timestamp      TIMESTAMPTZ,
  p_message_type   TEXT,
  p_participant_name TEXT DEFAULT NULL,
  p_participant_jid  TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_contact_id UUID;
BEGIN
  -- Upsert contato de forma atômica (sem race condition)
  INSERT INTO whatsapp_contacts (instance_name, phone, name, remote_jid, last_message_at)
  VALUES (p_instance_name, p_phone, p_contact_name, p_remote_jid, p_timestamp)
  ON CONFLICT (instance_name, phone) DO UPDATE
    SET remote_jid       = COALESCE(EXCLUDED.remote_jid, whatsapp_contacts.remote_jid),
        last_message_at  = GREATEST(whatsapp_contacts.last_message_at, EXCLUDED.last_message_at),
        -- Só atualiza nome se o novo não for igual ao phone (evita sobrescrever com JID)
        name = CASE
          WHEN EXCLUDED.name IS NOT NULL AND EXCLUDED.name <> p_phone
          THEN EXCLUDED.name
          ELSE whatsapp_contacts.name
        END
  RETURNING id INTO v_contact_id;

  -- Upsert mensagem vinculada ao contato
  INSERT INTO whatsapp_messages (
    contact_id, instance_name, message_id, from_me,
    body, message_type, timestamp, participant_name, participant_jid
  ) VALUES (
    v_contact_id, p_instance_name, p_message_id, p_from_me,
    p_body, p_message_type, p_timestamp, p_participant_name, p_participant_jid
  )
  ON CONFLICT (message_id) DO UPDATE
    SET participant_name = COALESCE(EXCLUDED.participant_name, whatsapp_messages.participant_name),
        participant_jid  = COALESCE(EXCLUDED.participant_jid,  whatsapp_messages.participant_jid);

  RETURN v_contact_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- BD-4: FOREIGN KEYS DE INTEGRIDADE REFERENCIAL
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_contacts_instance'
  ) THEN
    ALTER TABLE whatsapp_contacts
      ADD CONSTRAINT fk_contacts_instance
      FOREIGN KEY (instance_name)
      REFERENCES whatsapp_instances(instance_name)
      ON DELETE CASCADE;
  END IF;
END$$;

-- ============================================================
-- BD-5: RLS — Row Level Security nas tabelas WhatsApp
-- (service_role_key usada no servidor bypassa RLS automaticamente)
-- ============================================================

ALTER TABLE whatsapp_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_contacts  ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_messages  ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_funnels        ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_stages         ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_leads          ENABLE ROW LEVEL SECURITY;

-- Remover políticas antigas se existirem
DROP POLICY IF EXISTS "admin_instances" ON whatsapp_instances;
DROP POLICY IF EXISTS "admin_contacts"  ON whatsapp_contacts;
DROP POLICY IF EXISTS "admin_messages"  ON whatsapp_messages;
DROP POLICY IF EXISTS "admin_funnels"   ON crm_funnels;
DROP POLICY IF EXISTS "admin_stages"    ON crm_stages;
DROP POLICY IF EXISTS "admin_leads"     ON crm_leads;

-- Admin vê e gerencia tudo (política mínima necessária)
CREATE POLICY "admin_instances" ON whatsapp_instances FOR ALL
  USING (EXISTS (SELECT 1 FROM clients WHERE id = auth.uid() AND is_admin = TRUE));

CREATE POLICY "admin_contacts" ON whatsapp_contacts FOR ALL
  USING (EXISTS (SELECT 1 FROM clients WHERE id = auth.uid() AND is_admin = TRUE));

CREATE POLICY "admin_messages" ON whatsapp_messages FOR ALL
  USING (EXISTS (SELECT 1 FROM clients WHERE id = auth.uid() AND is_admin = TRUE));

CREATE POLICY "admin_funnels" ON crm_funnels FOR ALL
  USING (EXISTS (SELECT 1 FROM clients WHERE id = auth.uid() AND is_admin = TRUE));

CREATE POLICY "admin_stages" ON crm_stages FOR ALL
  USING (EXISTS (SELECT 1 FROM clients WHERE id = auth.uid() AND is_admin = TRUE));

CREATE POLICY "admin_leads" ON crm_leads FOR ALL
  USING (EXISTS (SELECT 1 FROM clients WHERE id = auth.uid() AND is_admin = TRUE));
