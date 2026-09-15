/**
 * POST /api/create-guest-checkout
 *
 * Called from the game page when a user clicks "Book". Proxies the request
 * to the game app backend's public guest-checkout endpoint, which:
 *   - creates (or reuses) a user by email
 *   - creates a game session
 *   - creates a Stripe PaymentIntent
 *   - returns { sessionId, clientSecret, stub }
 *
 * The client then uses `clientSecret` with Stripe.js to confirm the
 * payment inline (Stripe Elements), and Jonathan's Stripe webhook picks
 * up the successful payment and emails the buyer a magic sign-in link.
 *
 * We proxy server-to-server rather than calling the app backend directly
 * from the browser so that CORS + CSRF on his side aren't blockers.
 *
 * Body (from the browser):
 *   { gameId: string, tierId: string, teamName: string, displayName: string, email: string }
 *
 * Response:
 *   { sessionId, clientSecret, stub }        — 201
 *   { error: string, warningsRemaining? }    — 4xx/5xx
 *
 * ⚠️  MUST NOT be prerendered. Runs on every request.
 */

import type { APIRoute } from 'astro';

export const prerender = false;

interface GuestCheckoutRequest {
  gameId?: unknown;
  tierId?: unknown;
  teamName?: unknown;
  displayName?: unknown;
  email?: unknown;
}

export const POST: APIRoute = async ({ request }) => {
  const base = import.meta.env.APP_BACKEND_URL;
  if (!base) {
    console.error('APP_BACKEND_URL not set');
    return json({ error: 'checkout not configured' }, 500);
  }

  // --- Parse + validate request body ---
  let body: GuestCheckoutRequest;
  try {
    body = (await request.json()) as GuestCheckoutRequest;
  } catch {
    return json({ error: 'invalid JSON body' }, 400);
  }

  const gameId      = typeof body.gameId      === 'string' ? body.gameId.trim()      : '';
  const tierId      = typeof body.tierId      === 'string' ? body.tierId.trim()      : '';
  const teamName    = typeof body.teamName    === 'string' ? body.teamName.trim()    : '';
  const displayName = typeof body.displayName === 'string' ? body.displayName.trim() : '';
  const email       = typeof body.email       === 'string' ? body.email.trim()       : '';

  if (!gameId)      return json({ error: 'gameId is required' }, 400);
  if (!tierId)      return json({ error: 'tierId is required' }, 400);
  if (!teamName || teamName.length > 50) {
    return json({ error: 'teamName is required (1–50 characters)' }, 400);
  }
  if (!displayName || displayName.length > 50) {
    return json({ error: 'displayName is required (1–50 characters)' }, 400);
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json({ error: 'a valid email is required' }, 400);
  }

  // --- Forward to game app backend ---
  const url = `${base.replace(/\/$/, '')}/web-api/games/purchase-guest`;
  let upstream: Response;
  try {
    upstream = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json',
      },
      body: JSON.stringify({
        gameId,
        tierId,
        teamNickname: teamName,
        displayName,
        email,
      }),
    });
  } catch (err: any) {
    console.error('guest-checkout upstream fetch failed:', err);
    return json({ error: 'could not reach checkout service' }, 502);
  }

  const upstreamText = await upstream.text();
  let payload: any;
  try {
    payload = upstreamText ? JSON.parse(upstreamText) : null;
  } catch {
    // Upstream returned non-JSON — log the raw body for debugging.
    console.error(
      `guest-checkout upstream returned non-JSON (status ${upstream.status}):`,
      upstreamText.slice(0, 500)
    );
    return json({ error: 'checkout service returned an unexpected response' }, 502);
  }

  if (!upstream.ok) {
    // Pass through structured errors verbatim so the client can, e.g.,
    // show `warningsRemaining` for a blocked team nickname (422).
    console.warn(`guest-checkout upstream ${upstream.status}:`, payload);
    return json(payload ?? { error: 'checkout failed' }, upstream.status);
  }

  // Expected shape: { sessionId, clientSecret, stub }
  if (!payload?.clientSecret && !payload?.stub) {
    console.error('guest-checkout upstream ok but missing clientSecret/stub:', payload);
    return json({ error: 'checkout service returned an incomplete response' }, 502);
  }

  return json(payload, 201);
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}
