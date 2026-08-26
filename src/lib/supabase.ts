import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Supabase — public browser client (safe to expose to the client).
 *
 * Uses the anon key, which is scoped by Row Level Security policies
 * you set up in the Supabase dashboard. Any table this client can
 * read/write must have an RLS policy allowing that role.
 *
 * For server-side operations that need to bypass RLS (e.g. inserting
 * a booking from a Stripe webhook), use the service_role key inside
 * the webhook handler ONLY — never expose it to the browser. See
 * src/pages/api/stripe-webhook.ts for the server-side pattern.
 */

const url = import.meta.env.PUBLIC_SUPABASE_URL;
const anonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error(
    'Missing Supabase env vars. Set PUBLIC_SUPABASE_URL and PUBLIC_SUPABASE_ANON_KEY in .env'
  );
}

export const supabase: SupabaseClient = createClient(url, anonKey, {
  auth: {
    persistSession: false, // we don't have users; no auth needed
  },
});

/**
 * Shape of a row in the `scores` table (public read).
 * The app posts scores here at end of session via a server-side function.
 */
export interface ScoreRow {
  id: string;
  game_slug: string;
  city_slug: string;
  team_name: string;
  score_value: number;
  completion_seconds: number;
  achieved_at: string; // ISO timestamp
}

/**
 * Fetch the top N scores for a game, sorted by score desc then time asc.
 */
export async function fetchLeaderboard(
  gameSlug: string,
  limit = 25
): Promise<ScoreRow[]> {
  const { data, error } = await supabase
    .from('scores')
    .select('id, game_slug, city_slug, team_name, score_value, completion_seconds, achieved_at')
    .eq('game_slug', gameSlug)
    .order('score_value', { ascending: false })
    .order('completion_seconds', { ascending: true })
    .limit(limit);

  if (error) {
    console.error('Leaderboard fetch failed:', error);
    return [];
  }

  return data ?? [];
}
