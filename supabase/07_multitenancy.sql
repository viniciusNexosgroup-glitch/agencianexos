-- ─────────────────────────────────────────────────────────────────────────────
-- 07_multitenancy.sql
-- Adiciona coluna created_by às tabelas que não tinham isolamento multi-tenant.
-- Execute no Supabase SQL Editor antes de subir o código.
-- ─────────────────────────────────────────────────────────────────────────────

-- crm_funnels — cada usuário vê apenas seus próprios funis
ALTER TABLE crm_funnels ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES clients(id);

-- tags — cada usuário vê apenas suas próprias tags
ALTER TABLE tags ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES clients(id);

-- quick_replies — cada usuário vê apenas suas próprias respostas rápidas
ALTER TABLE quick_replies ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES clients(id);

-- crm_leads — rastreamento de quem criou o lead
ALTER TABLE crm_leads ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES clients(id);
