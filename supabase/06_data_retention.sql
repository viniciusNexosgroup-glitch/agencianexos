-- ─────────────────────────────────────────────────────────────────────────────
-- 06_data_retention.sql
-- Políticas de retenção de dados para manter o banco dentro do plano gratuito
-- do Supabase (500 MB). Execute no Supabase SQL Editor.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Tabela de configuração de retenção ────────────────────────────────────

CREATE TABLE IF NOT EXISTS data_retention_settings (
  key         TEXT PRIMARY KEY,
  value_days  INTEGER NOT NULL CHECK (value_days >= 0),
  description TEXT NOT NULL,
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Valores padrão. 0 = nunca limpar.
INSERT INTO data_retention_settings (key, value_days, description) VALUES
  ('messages_retention_days',             90,  'Mensagens WhatsApp mais antigas que X dias são apagadas'),
  ('notifications_read_retention_days',   30,  'Notificações já lidas mais antigas que X dias são apagadas'),
  ('sync_logs_retention_days',            60,  'Logs de sincronização Meta/Google mais antigos que X dias são apagados'),
  ('campaign_metrics_retention_days',    395,  'Métricas de campanhas mais antigas que X dias são apagadas (395 = 13 meses)'),
  ('flow_executions_retention_days',      90,  'Execuções de flows concluídas/falhas mais antigas que X dias são apagadas'),
  ('broadcast_retention_days',           180,  'Campanhas de broadcast finalizadas mais antigas que X dias são apagadas'),
  ('lead_history_retention_days',        365,  'Histórico de etapas de leads mais antigo que X dias é apagado'),
  ('enrollments_retention_days',         180,  'Inscrições em sequências concluídas/canceladas mais antigas que X dias são apagadas')
ON CONFLICT (key) DO NOTHING;

-- ── 2. Função principal de limpeza ───────────────────────────────────────────

CREATE OR REPLACE FUNCTION cleanup_old_data()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_messages_days       INTEGER;
  v_notif_days          INTEGER;
  v_sync_logs_days      INTEGER;
  v_metrics_days        INTEGER;
  v_flow_exec_days      INTEGER;
  v_broadcast_days      INTEGER;
  v_lead_history_days   INTEGER;
  v_enrollments_days    INTEGER;

  v_del_messages        BIGINT := 0;
  v_del_notifs          BIGINT := 0;
  v_del_sync_logs       BIGINT := 0;
  v_del_metrics         BIGINT := 0;
  v_del_flow_exec       BIGINT := 0;
  v_del_broadcast       BIGINT := 0;
  v_del_lead_history    BIGINT := 0;
  v_del_enrollments     BIGINT := 0;
BEGIN
  -- Carregar configurações
  SELECT value_days INTO v_messages_days     FROM data_retention_settings WHERE key = 'messages_retention_days';
  SELECT value_days INTO v_notif_days        FROM data_retention_settings WHERE key = 'notifications_read_retention_days';
  SELECT value_days INTO v_sync_logs_days    FROM data_retention_settings WHERE key = 'sync_logs_retention_days';
  SELECT value_days INTO v_metrics_days      FROM data_retention_settings WHERE key = 'campaign_metrics_retention_days';
  SELECT value_days INTO v_flow_exec_days    FROM data_retention_settings WHERE key = 'flow_executions_retention_days';
  SELECT value_days INTO v_broadcast_days    FROM data_retention_settings WHERE key = 'broadcast_retention_days';
  SELECT value_days INTO v_lead_history_days FROM data_retention_settings WHERE key = 'lead_history_retention_days';
  SELECT value_days INTO v_enrollments_days  FROM data_retention_settings WHERE key = 'enrollments_retention_days';

  -- 1. Mensagens WhatsApp (MAIOR IMPACTO)
  IF COALESCE(v_messages_days, 0) > 0 THEN
    DELETE FROM whatsapp_messages
    WHERE "timestamp" < NOW() - (v_messages_days || ' days')::INTERVAL;
    GET DIAGNOSTICS v_del_messages = ROW_COUNT;
  END IF;

  -- 2. Notificações já lidas
  IF COALESCE(v_notif_days, 0) > 0 THEN
    DELETE FROM notifications
    WHERE read = TRUE
      AND created_at < NOW() - (v_notif_days || ' days')::INTERVAL;
    GET DIAGNOSTICS v_del_notifs = ROW_COUNT;
  END IF;

  -- 3. Logs de sincronização
  IF COALESCE(v_sync_logs_days, 0) > 0 THEN
    DELETE FROM sync_logs
    WHERE created_at < NOW() - (v_sync_logs_days || ' days')::INTERVAL;
    GET DIAGNOSTICS v_del_sync_logs = ROW_COUNT;
  END IF;

  -- 4. Métricas de campanhas (Meta)
  IF COALESCE(v_metrics_days, 0) > 0 THEN
    DELETE FROM campaign_metrics
    WHERE metric_date < CURRENT_DATE - v_metrics_days;
    GET DIAGNOSTICS v_del_metrics = ROW_COUNT;
  END IF;

  -- 5. Execuções de flows finalizadas
  IF COALESCE(v_flow_exec_days, 0) > 0 THEN
    DELETE FROM flow_executions
    WHERE status IN ('completed', 'failed')
      AND updated_at < NOW() - (v_flow_exec_days || ' days')::INTERVAL;
    GET DIAGNOSTICS v_del_flow_exec = ROW_COUNT;
  END IF;

  -- 6. Campanhas de broadcast finalizadas (broadcast_recipients é ON DELETE CASCADE)
  IF COALESCE(v_broadcast_days, 0) > 0 THEN
    DELETE FROM broadcast_campaigns
    WHERE status IN ('completed', 'failed', 'cancelled')
      AND created_at < NOW() - (v_broadcast_days || ' days')::INTERVAL;
    GET DIAGNOSTICS v_del_broadcast = ROW_COUNT;
  END IF;

  -- 7. Histórico de etapas de leads
  IF COALESCE(v_lead_history_days, 0) > 0 THEN
    DELETE FROM lead_stage_history
    WHERE changed_at < NOW() - (v_lead_history_days || ' days')::INTERVAL;
    GET DIAGNOSTICS v_del_lead_history = ROW_COUNT;
  END IF;

  -- 8. Inscrições em sequências concluídas/canceladas
  IF COALESCE(v_enrollments_days, 0) > 0 THEN
    DELETE FROM sequence_enrollments
    WHERE status IN ('completed', 'cancelled')
      AND enrolled_at < NOW() - (v_enrollments_days || ' days')::INTERVAL;
    GET DIAGNOSTICS v_del_enrollments = ROW_COUNT;
  END IF;

  RETURN jsonb_build_object(
    'executed_at', NOW(),
    'deleted', jsonb_build_object(
      'whatsapp_messages',    v_del_messages,
      'notifications',        v_del_notifs,
      'sync_logs',            v_del_sync_logs,
      'campaign_metrics',     v_del_metrics,
      'flow_executions',      v_del_flow_exec,
      'broadcast_campaigns',  v_del_broadcast,
      'lead_stage_history',   v_del_lead_history,
      'sequence_enrollments', v_del_enrollments,
      'total', (
        v_del_messages + v_del_notifs + v_del_sync_logs + v_del_metrics +
        v_del_flow_exec + v_del_broadcast + v_del_lead_history + v_del_enrollments
      )
    )
  );
END;
$$;

-- ── 3. Função de estatísticas de armazenamento ───────────────────────────────

CREATE OR REPLACE FUNCTION get_storage_stats()
RETURNS TABLE (
  table_name  TEXT,
  row_count   BIGINT,
  total_size  TEXT,
  size_bytes  BIGINT
)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT
    t.tablename::TEXT,
    COALESCE(s.n_live_tup, 0)::BIGINT,
    pg_size_pretty(pg_total_relation_size(quote_ident(t.tablename))),
    pg_total_relation_size(quote_ident(t.tablename))::BIGINT
  FROM pg_tables t
  LEFT JOIN pg_stat_user_tables s ON s.relname = t.tablename
  WHERE t.schemaname = 'public'
  ORDER BY pg_total_relation_size(quote_ident(t.tablename)) DESC;
$$;

-- ── 4. Função de prévia — quantos registros seriam apagados ─────────────────

CREATE OR REPLACE FUNCTION preview_cleanup()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  v_messages_days       INTEGER;
  v_notif_days          INTEGER;
  v_sync_logs_days      INTEGER;
  v_metrics_days        INTEGER;
  v_flow_exec_days      INTEGER;
  v_broadcast_days      INTEGER;
  v_lead_history_days   INTEGER;
  v_enrollments_days    INTEGER;
  v_cnt_messages        BIGINT;
  v_cnt_notifs          BIGINT;
  v_cnt_sync_logs       BIGINT;
  v_cnt_metrics         BIGINT;
  v_cnt_flow_exec       BIGINT;
  v_cnt_broadcast       BIGINT;
  v_cnt_lead_history    BIGINT;
  v_cnt_enrollments     BIGINT;
BEGIN
  SELECT value_days INTO v_messages_days     FROM data_retention_settings WHERE key = 'messages_retention_days';
  SELECT value_days INTO v_notif_days        FROM data_retention_settings WHERE key = 'notifications_read_retention_days';
  SELECT value_days INTO v_sync_logs_days    FROM data_retention_settings WHERE key = 'sync_logs_retention_days';
  SELECT value_days INTO v_metrics_days      FROM data_retention_settings WHERE key = 'campaign_metrics_retention_days';
  SELECT value_days INTO v_flow_exec_days    FROM data_retention_settings WHERE key = 'flow_executions_retention_days';
  SELECT value_days INTO v_broadcast_days    FROM data_retention_settings WHERE key = 'broadcast_retention_days';
  SELECT value_days INTO v_lead_history_days FROM data_retention_settings WHERE key = 'lead_history_retention_days';
  SELECT value_days INTO v_enrollments_days  FROM data_retention_settings WHERE key = 'enrollments_retention_days';

  SELECT COUNT(*) INTO v_cnt_messages FROM whatsapp_messages
    WHERE COALESCE(v_messages_days,0) > 0 AND "timestamp" < NOW() - (v_messages_days || ' days')::INTERVAL;
  SELECT COUNT(*) INTO v_cnt_notifs FROM notifications
    WHERE COALESCE(v_notif_days,0) > 0 AND read = TRUE AND created_at < NOW() - (v_notif_days || ' days')::INTERVAL;
  SELECT COUNT(*) INTO v_cnt_sync_logs FROM sync_logs
    WHERE COALESCE(v_sync_logs_days,0) > 0 AND created_at < NOW() - (v_sync_logs_days || ' days')::INTERVAL;
  SELECT COUNT(*) INTO v_cnt_metrics FROM campaign_metrics
    WHERE COALESCE(v_metrics_days,0) > 0 AND metric_date < CURRENT_DATE - v_metrics_days;
  SELECT COUNT(*) INTO v_cnt_flow_exec FROM flow_executions
    WHERE COALESCE(v_flow_exec_days,0) > 0 AND status IN ('completed','failed') AND updated_at < NOW() - (v_flow_exec_days || ' days')::INTERVAL;
  SELECT COUNT(*) INTO v_cnt_broadcast FROM broadcast_campaigns
    WHERE COALESCE(v_broadcast_days,0) > 0 AND status IN ('completed','failed','cancelled') AND created_at < NOW() - (v_broadcast_days || ' days')::INTERVAL;
  SELECT COUNT(*) INTO v_cnt_lead_history FROM lead_stage_history
    WHERE COALESCE(v_lead_history_days,0) > 0 AND changed_at < NOW() - (v_lead_history_days || ' days')::INTERVAL;
  SELECT COUNT(*) INTO v_cnt_enrollments FROM sequence_enrollments
    WHERE COALESCE(v_enrollments_days,0) > 0 AND status IN ('completed','cancelled') AND enrolled_at < NOW() - (v_enrollments_days || ' days')::INTERVAL;

  RETURN jsonb_build_object(
    'would_delete', jsonb_build_object(
      'whatsapp_messages',    v_cnt_messages,
      'notifications',        v_cnt_notifs,
      'sync_logs',            v_cnt_sync_logs,
      'campaign_metrics',     v_cnt_metrics,
      'flow_executions',      v_cnt_flow_exec,
      'broadcast_campaigns',  v_cnt_broadcast,
      'lead_stage_history',   v_cnt_lead_history,
      'sequence_enrollments', v_cnt_enrollments,
      'total', (
        v_cnt_messages + v_cnt_notifs + v_cnt_sync_logs + v_cnt_metrics +
        v_cnt_flow_exec + v_cnt_broadcast + v_cnt_lead_history + v_cnt_enrollments
      )
    )
  );
END;
$$;

-- ── 5. RLS para data_retention_settings ─────────────────────────────────────

ALTER TABLE data_retention_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "retention_admin_all" ON data_retention_settings;
CREATE POLICY "retention_admin_all" ON data_retention_settings
  FOR ALL USING (
    EXISTS (SELECT 1 FROM clients WHERE id = auth.uid() AND is_admin = TRUE)
  );
