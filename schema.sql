-- DraftCoach — Neon schema
-- Neon dashboard'unda SQL Editor'a yapıştır ve çalıştır

CREATE TABLE IF NOT EXISTS users (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  strava_id        BIGINT UNIQUE NOT NULL,
  name             TEXT,
  email            TEXT,
  profile_photo    TEXT,
  access_token     TEXT,
  refresh_token    TEXT,
  token_expires_at TIMESTAMPTZ,
  updated_at       TIMESTAMPTZ DEFAULT NOW(),
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS activities (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id          UUID REFERENCES users(id) ON DELETE CASCADE,
  strava_id        BIGINT UNIQUE NOT NULL,
  name             TEXT,
  type             TEXT,
  distance_km      FLOAT,
  duration_seconds INT,
  moving_seconds   INT,
  avg_speed_kmh    FLOAT,
  max_speed_kmh    FLOAT,
  elevation_gain_m FLOAT,
  hr_avg           FLOAT,
  hr_max           FLOAT,
  started_at       TIMESTAMPTZ,
  raw_data         JSONB,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS analyses (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  activity_id UUID REFERENCES activities(id) ON DELETE CASCADE,
  user_id     UUID REFERENCES users(id) ON DELETE CASCADE,
  cards       JSONB,
  ai_model    TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activities_user_id   ON activities(user_id);
CREATE INDEX IF NOT EXISTS idx_activities_started_at ON activities(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_analyses_activity_id  ON analyses(activity_id);
