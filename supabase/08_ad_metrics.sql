CREATE TABLE IF NOT EXISTS ad_metrics (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  ad_account_id    TEXT NOT NULL,
  ad_id            TEXT NOT NULL,
  ad_name          TEXT,
  campaign_id      TEXT,
  campaign_name    TEXT,
  adset_id         TEXT,
  adset_name       TEXT,
  thumbnail_url    TEXT,
  effective_status TEXT,
  metric_date      DATE NOT NULL,
  impressions      BIGINT DEFAULT 0,
  reach            BIGINT DEFAULT 0,
  clicks           BIGINT DEFAULT 0,
  spend            DECIMAL(12,2) DEFAULT 0,
  ctr              DECIMAL(8,4) DEFAULT 0,
  cpc              DECIMAL(10,2),
  cpm              DECIMAL(10,2),
  purchases        INTEGER DEFAULT 0,
  purchase_value   DECIMAL(12,2) DEFAULT 0,
  leads            INTEGER DEFAULT 0,
  checkouts        INTEGER DEFAULT 0,
  frequency        DECIMAL(6,2) DEFAULT 0,
  synced_at        TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(ad_id, metric_date)
);

CREATE INDEX IF NOT EXISTS idx_ad_metrics_account_date
  ON ad_metrics(ad_account_id, metric_date);
