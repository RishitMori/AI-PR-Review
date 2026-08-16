CREATE TABLE IF NOT EXISTS repository_settings (
  id SERIAL PRIMARY KEY,
  repo_id INTEGER UNIQUE NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
  enabled BOOLEAN DEFAULT TRUE NOT NULL,
  review_on_opened BOOLEAN DEFAULT TRUE NOT NULL,
  review_on_synchronize BOOLEAN DEFAULT TRUE NOT NULL,
  review_on_reopened BOOLEAN DEFAULT TRUE NOT NULL,
  max_comments INTEGER DEFAULT 6 NOT NULL,
  review_tone VARCHAR(50) DEFAULT 'balanced' NOT NULL,
  ignored_patterns TEXT DEFAULT '' NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT repository_settings_max_comments_check CHECK (max_comments >= 1 AND max_comments <= 20),
  CONSTRAINT repository_settings_review_tone_check CHECK (review_tone IN ('light', 'balanced', 'strict'))
);

INSERT INTO repository_settings (repo_id)
SELECT id FROM repositories
ON CONFLICT (repo_id) DO NOTHING;
