CREATE TABLE IF NOT EXISTS google_keyword_metrics (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id   TEXT NOT NULL,
  campaign_name TEXT,
  ad_group_name TEXT,
  keyword       TEXT NOT NULL,
  match_type    TEXT,
  metric_date   DATE NOT NULL,
  impressions   BIGINT DEFAULT 0,
  clicks        BIGINT DEFAULT 0,
  spend         DECIMAL(12,2) DEFAULT 0,
  conversions   DECIMAL(8,2) DEFAULT 0,
  ctr           DECIMAL(10,8) DEFAULT 0,
  synced_at     TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(customer_id, keyword, match_type, campaign_name, metric_date)
);

CREATE TABLE IF NOT EXISTS google_search_term_metrics (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id   TEXT NOT NULL,
  campaign_name TEXT,
  ad_group_name TEXT,
  search_term   TEXT NOT NULL,
  metric_date   DATE NOT NULL,
  impressions   BIGINT DEFAULT 0,
  clicks        BIGINT DEFAULT 0,
  spend         DECIMAL(12,2) DEFAULT 0,
  conversions   DECIMAL(8,2) DEFAULT 0,
  ctr           DECIMAL(10,8) DEFAULT 0,
  synced_at     TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(customer_id, search_term, campaign_name, metric_date)
);

CREATE INDEX IF NOT EXISTS idx_google_keyword_date ON google_keyword_metrics(customer_id, metric_date);
CREATE INDEX IF NOT EXISTS idx_google_search_term_date ON google_search_term_metrics(customer_id, metric_date);
