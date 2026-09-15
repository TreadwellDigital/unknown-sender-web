/**
 * App-backend read layer.
 *
 * Fetches game metadata + price tiers from the app's public API
 * (documented in API_CONTRACT.md at repo root).
 *
 * The types below match what the app currently returns from
 * GET /api/games (confirmed against production endpoint), with three
 * OPTIONAL fields that we've asked the app team to add:
 *   - `slug`             — URL-safe identifier
 *   - `published`        — visibility filter to hide test data
 *   - `tiers[].stripePriceId` — Stripe price id for Checkout
 *
 * Once those land, the site code below will start using them without
 * further changes. Until then, the site falls back to Markdown data
 * for slug matching and inlines `price_data` at checkout time.
 */

export interface LiveTier {
  id: string;
  label: string;
  minPlayers?: number;
  maxPlayers: number;
  /**
   * Price in POUNDS as a decimal (e.g. 40.0 = £40, 12.50 = £12.50).
   * Confirmed by app team's admin UI — the field holds pounds, not pence.
   */
  price: number;
  stripePriceId?: string;
}

export interface LiveGame {
  id: string;
  /**
   * URL-safe identifier used by the site to match its route (`/games/last-call`)
   * to the app's game record. Optional: falls back to slugified name matching
   * if the app hasn't populated it yet.
   */
  siteId?: string;
  name: string;
  description?: string;
  location?: string;
  latitude?: number | null;
  longitude?: number | null;
  tiers: LiveTier[];
  whatToExpectPoints?: string[];
}

/**
 * Fetch the full games catalogue from the app.
 * Returns [] if the endpoint isn't configured or unreachable — callers
 * should fall back to content-collection data for display.
 */
export async function fetchGamesCatalogue(
  { signal }: { signal?: AbortSignal } = {}
): Promise<LiveGame[]> {
  const base = import.meta.env.APP_BACKEND_URL;
  if (!base) return [];
  // Trim trailing slash so `${base}/api/games` doesn't become `//api/games`.
  const normalisedBase = base.replace(/\/$/, '');

  try {
    const res = await fetch(`${normalisedBase}/api/games`, {
      headers: { accept: 'application/json' },
      signal,
    });
    if (!res.ok) return [];
    const data = (await res.json()) as unknown;
    if (!Array.isArray(data)) return [];
    return data.filter(isLiveGame);
  } catch {
    return [];
  }
}

/**
 * Fetch a single game from the catalogue by its site slug.
 *
 * Strategy today: fetch the whole catalogue, match on `slug` if
 * present, otherwise match on a normalised `name` (slugifying it
 * to compare). Once the app returns `slug` natively, the name
 * fallback goes away.
 */
export async function fetchGameBySlug(
  siteSlug: string,
  opts: { signal?: AbortSignal } = {}
): Promise<LiveGame | null> {
  const all = await fetchGamesCatalogue(opts);
  if (!all.length) return null;

  const bySiteId = all.find((g) => g.siteId === siteSlug);
  if (bySiteId) return bySiteId;

  // Fallback: slugify the game's `name` and compare. Kept for resilience
  // in case the app team ever ships a game record without a siteId set.
  return all.find((g) => slugify(g.name) === siteSlug) ?? null;
}

/**
 * Look up a single tier by id from a fetched LiveGame.
 * Used by the create-guest-checkout route to resolve the
 * user's chosen tier to a Stripe price_id (or price_data fallback).
 */
export function findTier(game: LiveGame, tierId: string): LiveTier | null {
  return game.tiers.find((t) => t.id === tierId) ?? null;
}

/**
 * Format a price given in PENCE (integer) for display.
 * Used for the site's Markdown price tiers (`pricePence: 4000` = £40).
 */
export function formatPricePence(pricePence: number): string {
  const pounds = pricePence / 100;
  return pounds % 1 === 0
    ? `£${pounds.toFixed(0)}`
    : `£${pounds.toFixed(2)}`;
}

/**
 * Format a price given in POUNDS (decimal) for display.
 * Used for the app API's `price` field (`price: 40` = £40).
 */
export function formatPricePounds(pounds: number): string {
  return pounds % 1 === 0
    ? `£${pounds.toFixed(0)}`
    : `£${pounds.toFixed(2)}`;
}

/**
 * Legacy alias — same as formatPricePence. Kept so existing callers
 * keep working while we standardise on the explicit-unit names above.
 */
export const formatPrice = formatPricePence;

/**
 * Normalise a string to a URL slug — used for the temporary
 * name-based matching until the app returns `slug` natively.
 */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// --- Runtime shape check (defensive; app could regress the schema) ---
// Only the fields we actually depend on are required. `siteId`,
// `whatToExpectPoints` and geo fields are optional so a partial API
// response still yields a usable game (with graceful fallback to
// Markdown for missing fields, and slug-name matching if siteId absent).
function isLiveGame(x: unknown): x is LiveGame {
  if (!x || typeof x !== 'object') return false;
  const g = x as Record<string, unknown>;
  if (typeof g.id !== 'string' || !g.id) return false;
  if (typeof g.name !== 'string' || !g.name) return false;
  if (!Array.isArray(g.tiers) || g.tiers.length === 0) return false;
  for (const t of g.tiers) {
    if (!t || typeof t !== 'object') return false;
    const tier = t as Record<string, unknown>;
    if (typeof tier.id !== 'string' || !tier.id) return false;
    if (typeof tier.label !== 'string') return false;
    if (typeof tier.maxPlayers !== 'number') return false;
    if (typeof tier.price !== 'number') return false;
  }
  return true;
}
