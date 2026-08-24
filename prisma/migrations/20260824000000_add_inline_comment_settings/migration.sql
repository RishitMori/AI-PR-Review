ALTER TABLE repository_settings
  ADD COLUMN IF NOT EXISTS max_inline_comments INTEGER DEFAULT 2 NOT NULL,
  ADD COLUMN IF NOT EXISTS max_inline_comments_per_file INTEGER DEFAULT 1 NOT NULL;

ALTER TABLE repository_settings
  ADD CONSTRAINT repository_settings_max_inline_comments_check CHECK (max_inline_comments >= 0 AND max_inline_comments <= 3),
  ADD CONSTRAINT repository_settings_max_inline_comments_per_file_check CHECK (max_inline_comments_per_file >= 1 AND max_inline_comments_per_file <= 2);
