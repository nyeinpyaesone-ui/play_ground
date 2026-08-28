CREATE TABLE IF NOT EXISTS training_runs (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  base_model TEXT NOT NULL,
  dataset TEXT NOT NULL,
  method TEXT NOT NULL CHECK (method IN ('LoRA','QLoRA','SFT')),
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','running','completed','failed','cancelled')),
  loss DOUBLE PRECISION,
  eval_score DOUBLE PRECISION,
  throughput DOUBLE PRECISION,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  error_message TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS training_runs_status_idx ON training_runs(status);
CREATE INDEX IF NOT EXISTS training_runs_created_at_idx ON training_runs(created_at DESC);
