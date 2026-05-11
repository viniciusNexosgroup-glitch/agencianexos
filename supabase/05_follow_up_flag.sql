-- Flag manual de follow-up por contato
ALTER TABLE whatsapp_contacts
  ADD COLUMN IF NOT EXISTS follow_up BOOLEAN DEFAULT FALSE;
