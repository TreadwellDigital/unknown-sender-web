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
  minPlayers: number;
  maxPlayers: number;
  /** Price in pence, stored as a float by the app (e.g. 30.0 = £0.30) */
  price: number;
  /** OPTIONAL — Stripe price_id. Requested addition (see API_CONTRACT.md) */
  stripePriceId?: string;
}

export interface LiveGame {
  id: string;
  name: string;
  description: string;
  location: string;
  latitude: number | null;
  longitude: number | null;
  tiers: LiveTier[];
  whatToExpectPoints: string[];
  /** OPTIONAL — URL-safe slug. Requested addition */
  slug?: string;
  /** OPTIONAL — visibility flag. Requested addition; default true if absent */
  published?: boolean;
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

  try {
    const res = await fetch(`${base}/api/games`, {
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

  const byExplicitSlug = all.find((g) => g.slug === siteSlug);
  if (byExplicitSlug) return byExplicitSlug;

  // Fallback: slugify the name and compare
  return all.find((g) => slugify(g.name) === siteSlug) ?? null;
}

/**
 * Look up a single tier by id from a fetched LiveGame.
 * Used by the create-checkout-session route to resolve the
 * user's chosen tier to a Stripe price_id (or price_data fallback).
 */
export function findTier(game: LiveGame, tierId: string): LiveTier | null {
  return game.tiers.find((t) => t.id === tierId) ?? null;
}

/**
 * Format a price for display. The app returns price in pence
 * as a float; we render it as pounds, showing pence only when
 * the value isn't a whole pound.
 */
export function formatPrice(pricePence: number): string {
  const pounds = pricePence / 100;
  return pounds % 1 === 0
    ? `£${pounds.toFixed(0)}`
    : `£${pounds.toFixed(2)}`;
}

/**
 * Back-compat alias for the older name used across page components.
 * Both names accept pence and return "£X" or "£X.YY".
 */
export const formatPricePence = formatPrice;

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
function isLiveGame(x: unknown): x is LiveGame {
  if (!x || typeof x !== 'object') return false;
  const g = x as Record<string, unknown>;
  if (typeof g.id !== 'string') return false;
  if (typeof g.name !== 'string') return false;
  if (typeof g.description !== 'string') return false;
  if (typeof g.location !== 'string') return false;
  if (g.latitude !== null && typeof g.latitude !== 'number') return false;
  if (g.longitude !== null && typeof g.longitude !== 'number') return false;
  if (!Array.isArray(g.tiers)) return false;
  for (const t of g.tiers) {
    if (!t || typeof t !== 'object') return false;
    const tier = t as Record<string, unknown>;
    if (typeof tier.id !== 'string') return false;
    if (typeof tier.label !== 'string') return false;
    if (typeof tier.minPlayers !== 'number') return false;
    if (typeof tier.maxPlayers !== 'number') return false;
    if (typeof tier.price !== 'number') return false;
    if (tier.stripePriceId !== undefined && typeof tier.stripePriceId !== 'string') return false;
  }
  if (!Array.isArray(g.whatToExpectPoints)) return false;
  if (g.slug !== undefined && typeof g.slug !== 'string') return false;
  if (g.published !== undefined && typeof g.published !== 'boolean') return false;
  return true;
}
