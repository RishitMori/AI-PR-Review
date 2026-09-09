CREATE TABLE IF NOT EXISTS review_jobs (
  id SERIAL PRIMARY KEY,
  job_id VARCHAR(500) UNIQUE NOT NULL,
  payload JSONB NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 3,
  locked_at TIMESTAMP,
  locked_by VARCHAR(100),
  last_error TEXT,
  available_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_review_jobs_status_available_at ON review_jobs(status, available_at);
