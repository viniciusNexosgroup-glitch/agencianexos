CREATE TABLE IF NOT EXISTS google_oauth_tokens (
  id         INT PRIMARY KEY DEFAULT 1,
  refresh_token TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT single_row CHECK (id = 1)
);
