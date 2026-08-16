CREATE TABLE IF NOT EXISTS github_installations (
  id SERIAL PRIMARY KEY,
  github_installation_id BIGINT UNIQUE NOT NULL,
  account_github_id BIGINT,
  account_login VARCHAR(255),
  account_type VARCHAR(50),
  suspended_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS github_installations_account_github_id_idx ON github_installations(account_github_id);

CREATE TABLE IF NOT EXISTS user_installations (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  installation_id INTEGER NOT NULL REFERENCES github_installations(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW(),
  last_seen_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, installation_id)
);

CREATE INDEX IF NOT EXISTS user_installations_installation_id_idx ON user_installations(installation_id);

ALTER TABLE repositories ADD COLUMN IF NOT EXISTS installation_id INTEGER REFERENCES github_installations(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS repositories_installation_id_idx ON repositories(installation_id);
