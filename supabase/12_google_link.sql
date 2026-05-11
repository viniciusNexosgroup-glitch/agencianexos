-- Vinculação de conta Google Ads à conta Meta Ads
ALTER TABLE client_accounts
  ADD COLUMN IF NOT EXISTS google_customer_id TEXT;
