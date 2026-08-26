-- ============================================================
-- Unknown Sender — initial schema
--
-- Run this in the Supabase SQL Editor:
--   Dashboard > SQL Editor > New Query > paste this > Run
-- ============================================================

-- ------------------------------------------------------------
-- bookings
-- Each row = one paid Stripe Checkout session.
-- Private. Only the service_role key (used inside our webhook)
-- may read/write. The anon key has no access.
-- ------------------------------------------------------------
CREATE TABLE bookings (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_code      TEXT UNIQUE NOT NULL,           -- e.g. US-AB4T-9K2M
  game_slug         TEXT NOT NULL,
  tier_id           TEXT NOT NULL,                  -- matches content collection tier.id
  team_name         TEXT NOT NULL,
  buyer_email       TEXT NOT NULL,
  stripe_session_id TEXT UNIQUE NOT NULL,
  amount_paid_pence INTEGER NOT NULL,
  currency          TEXT NOT NULL DEFAULT 'gbp',
  status            TEXT NOT NULL DEFAULT 'paid',   -- 'paid' | 'redeemed' | 'refunded' | 'cancelled'
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at        TIMESTAMPTZ NOT NULL,
  redeemed_at       TIMESTAMPTZ,
  metadata          JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX bookings_email_idx ON bookings (buyer_email);
CREATE INDEX bookings_game_idx  ON bookings (game_slug);

-- ------------------------------------------------------------
-- scores
-- Public leaderboard for each game. One row per completed session.
-- The app backend writes here (via service_role); everyone can read.
-- ------------------------------------------------------------
CREATE TABLE scores (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_code        TEXT NOT NULL REFERENCES bookings(booking_code) ON DELETE CASCADE,
  game_slug           TEXT NOT NULL,
  city_slug           TEXT NOT NULL,
  team_name           TEXT NOT NULL,
  score_value         INTEGER NOT NULL,
  completion_seconds  INTEGER NOT NULL,
  achieved_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Composite index matches the leaderboard query
-- (game_slug WHERE, score_value DESC, completion_seconds ASC).
CREATE INDEX scores_game_leaderboard_idx
  ON scores (game_slug, score_value DESC, completion_seconds ASC);

-- ------------------------------------------------------------
-- Row Level Security
-- ------------------------------------------------------------
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE scores   ENABLE ROW LEVEL SECURITY;

-- bookings: no policies → anon has zero access. service_role bypasses RLS.
-- (Deliberately no INSERT/SELECT policies for anon.)

-- scores: public read, no public write.
CREATE POLICY "anon can read scores"
  ON scores
  FOR SELECT
  TO anon
  USING (true);

-- ------------------------------------------------------------
-- Notes for the app-backend team
-- ------------------------------------------------------------
-- 1. Insert bookings only via the site's Stripe webhook. The app
--    should never insert into bookings directly.
-- 2. Insert scores from the app when a session ends. Use the
--    service_role key server-side, or an Edge Function with its
--    own auth. Include booking_code so the FK to bookings holds.
-- 3. Never expose the service_role key to any client (native app
--    or browser). All writes must go through your backend.
