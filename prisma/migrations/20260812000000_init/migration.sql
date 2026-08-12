CREATE TABLE IF NOT EXISTS repositories (
  id SERIAL PRIMARY KEY,
  github_id BIGINT UNIQUE NOT NULL,
  owner VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  installed_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pull_requests (
  id SERIAL PRIMARY KEY,
  repo_id INTEGER REFERENCES repositories(id) ON DELETE CASCADE,
  pr_number INTEGER NOT NULL,
  pr_title VARCHAR(500),
  pr_author VARCHAR(255),
  head_sha VARCHAR(40) NOT NULL,
  status VARCHAR(50) DEFAULT 'pending',
  github_summary_comment_id BIGINT,
  failure_message TEXT,
  failed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(repo_id, pr_number, head_sha)
);

ALTER TABLE pull_requests ADD COLUMN IF NOT EXISTS failure_message TEXT;
ALTER TABLE pull_requests ADD COLUMN IF NOT EXISTS failed_at TIMESTAMP;

CREATE TABLE IF NOT EXISTS reviews (
  id SERIAL PRIMARY KEY,
  pr_id INTEGER REFERENCES pull_requests(id) ON DELETE CASCADE,
  overall_score INTEGER,
  summary TEXT,
  llm_provider VARCHAR(100),
  llm_model VARCHAR(150),
  prompt_tokens INTEGER,
  completion_tokens INTEGER,
  raw_response JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS review_comments (
  id SERIAL PRIMARY KEY,
  review_id INTEGER REFERENCES reviews(id) ON DELETE CASCADE,
  file_path VARCHAR(500),
  line_number INTEGER,
  severity VARCHAR(50),
  comment TEXT NOT NULL,
  github_comment_id BIGINT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS webhook_events (
  id SERIAL PRIMARY KEY,
  delivery_id VARCHAR(255) UNIQUE NOT NULL,
  event_name VARCHAR(100) NOT NULL,
  action VARCHAR(100),
  repo_full_name VARCHAR(255),
  pr_number INTEGER,
  received_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pull_requests_status ON pull_requests(status);
CREATE INDEX IF NOT EXISTS idx_pull_requests_repo_pr ON pull_requests(repo_id, pr_number);
CREATE INDEX IF NOT EXISTS idx_reviews_pr_id ON reviews(pr_id);
CREATE INDEX IF NOT EXISTS idx_review_comments_review_id ON review_comments(review_id);
