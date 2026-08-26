CREATE TABLE IF NOT EXISTS user_repository_selections (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  repo_id INTEGER NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
  selected_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, repo_id)
);

CREATE INDEX IF NOT EXISTS user_repository_selections_repo_id_idx ON user_repository_selections(repo_id);

WITH plan_limits AS (
  SELECT
    id AS user_id,
    username,
    CASE
      WHEN billing_status = 'active' AND lower(plan_name) = 'scale' THEN NULL
      WHEN billing_status = 'active' AND lower(plan_name) = 'pro' THEN 5
      WHEN billing_status = 'active' AND lower(plan_name) IN ('basic', 'starter') THEN 2
      ELSE 1
    END AS repo_limit
  FROM users
),
visible_repositories AS (
  SELECT
    pl.user_id,
    r.id AS repo_id,
    r.installed_at,
    pl.repo_limit
  FROM plan_limits pl
  JOIN user_installations ui ON ui.user_id = pl.user_id
  JOIN github_installations gi ON gi.id = ui.installation_id AND gi.suspended_at IS NULL
  JOIN repositories r ON r.installation_id = gi.id

  UNION

  SELECT
    pl.user_id,
    r.id AS repo_id,
    r.installed_at,
    pl.repo_limit
  FROM plan_limits pl
  JOIN repositories r ON r.installation_id IS NULL AND r.owner = pl.username
),
ranked_repositories AS (
  SELECT
    user_id,
    repo_id,
    repo_limit,
    ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY installed_at DESC NULLS LAST, repo_id DESC) AS repo_rank
  FROM visible_repositories
)
INSERT INTO user_repository_selections (user_id, repo_id)
SELECT user_id, repo_id
FROM ranked_repositories
WHERE repo_limit IS NULL OR repo_rank <= repo_limit
ON CONFLICT (user_id, repo_id) DO NOTHING;
