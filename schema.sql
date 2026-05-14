CREATE TABLE IF NOT EXISTS organisations (
  id SERIAL PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  slug VARCHAR(100) UNIQUE NOT NULL,
  api_key VARCHAR(64) UNIQUE NOT NULL,
  inbound_token VARCHAR(32) UNIQUE NOT NULL,  -- email: newsletter-{token}@yourdomain.com
  trusted_sender VARCHAR(255),                 -- only trigger calls from this address
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS subscribers (
  id SERIAL PRIMARY KEY,
  org_id INT NOT NULL REFERENCES organisations(id),
  email VARCHAR(255) NOT NULL,
  phone VARCHAR(20) NOT NULL,
  name VARCHAR(100),
  active BOOLEAN DEFAULT TRUE,
  confirmed BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(org_id, email)
);

CREATE TABLE IF NOT EXISTS sends (
  id SERIAL PRIMARY KEY,
  org_id INT NOT NULL REFERENCES organisations(id),
  subject VARCHAR(500),
  original_content TEXT,
  rewritten_script TEXT,
  audio_url TEXT,
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  total_subscribers INT DEFAULT 0
);

CREATE TABLE IF NOT EXISTS call_log (
  id SERIAL PRIMARY KEY,
  send_id INT REFERENCES sends(id),
  subscriber_id INT REFERENCES subscribers(id),
  twilio_call_sid VARCHAR(100),
  status VARCHAR(50),
  duration_secs INT,
  unsubscribed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subscribers_org ON subscribers(org_id);
CREATE INDEX IF NOT EXISTS idx_sends_org ON sends(org_id);
CREATE INDEX IF NOT EXISTS idx_call_log_send ON call_log(send_id);
CREATE INDEX IF NOT EXISTS idx_call_log_subscriber ON call_log(subscriber_id);
CREATE INDEX IF NOT EXISTS idx_call_log_sid ON call_log(twilio_call_sid);

-- Add audio_data column if upgrading from file-based storage
ALTER TABLE sends ADD COLUMN IF NOT EXISTS audio_data BYTEA;
