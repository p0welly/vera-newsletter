CREATE TABLE IF NOT EXISTS subscribers (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,       -- e.g. 07712345678@yourdomain.com
  phone VARCHAR(20) NOT NULL,               -- E.164 format: +447712345678
  name VARCHAR(100),
  active BOOLEAN DEFAULT TRUE,
  confirmed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sends (
  id SERIAL PRIMARY KEY,
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
  status VARCHAR(50),                       -- initiated, ringing, answered, completed, failed, no-answer
  duration_secs INT,
  unsubscribed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_call_log_send ON call_log(send_id);
CREATE INDEX IF NOT EXISTS idx_call_log_subscriber ON call_log(subscriber_id);
CREATE INDEX IF NOT EXISTS idx_call_log_sid ON call_log(twilio_call_sid);
