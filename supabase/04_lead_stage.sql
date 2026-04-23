-- ============================================================
-- Etapa padrão "Lead" — primeira coluna em todos os funis
-- Execute no Supabase SQL Editor
-- ============================================================

-- 1. Desloca posição das etapas existentes em todos os funis (+1)
UPDATE crm_stages SET position = position + 1;

-- 2. Insere etapa "Lead" na posição 0 de cada funil (se não existir)
INSERT INTO crm_stages (funnel_id, name, color, position)
SELECT id, 'Lead', '#8b5cf6', 0
FROM crm_funnels
WHERE id NOT IN (
  SELECT funnel_id FROM crm_stages WHERE name = 'Lead' AND position = 0
);
