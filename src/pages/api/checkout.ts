/**
 * POST /api/checkout
 *
 * Proxies to the game app backend's public guest-checkout endpoint:
 *   - creates (or reuses) a user by email
 *   - creates a game session
 *   - creates a Stripe PaymentIntent
 *   - returns { sessionId, clientSecret, stub }
 *
 * The client uses `clientSecret` with Stripe.js to confirm the payment
 * inline, and Jonathan's Stripe webhook picks up the successful payment
 * and emails the buyer a magic sign-in link.
 *
 * We proxy server-to-server rather than calling the app backend directly
 * from the browser so that CORS + CSRF on his side aren't blockers.
 */

export const prerender = false;

// APP_BACKEND_URL isn't a secret — hardcoded fallback keeps this endpoint
// alive even if the Cloudflare env var doesn't propagate.
const DEFAULT_APP_BACKEND_URL = 'https://api.unknownsender.co.uk';

export async function POST({ request, locals }: { request: Request; locals: any }) {
  try {
    const base = resolveAppBackendUrl(locals);

    let body: any;
    try {
      body = await request.json();
    } catch {
      return json({ error: 'invalid JSON body' }, 400);
    }

    const gameId      = typeof body?.gameId      === 'string' ? body.gameId.trim()      : '';
    const tierId      = typeof body?.tierId      === 'string' ? body.tierId.trim()      : '';
    const teamName    = typeof body?.teamName    === 'string' ? body.teamName.trim()    : '';
    const displayName = typeof body?.displayName === 'string' ? body.displayName.trim() : '';
    const email       = typeof body?.email       === 'string' ? body.email.trim()       : '';

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

    const url = `${base}/web-api/games/purchase-guest`;
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
      return json({
        error: `could not reach checkout service: ${err?.message || 'network error'}`,
      }, 502);
    }

    const upstreamText = await upstream.text();
    let payload: any;
    try {
      payload = upstreamText ? JSON.parse(upstreamText) : null;
    } catch {
      return json({
        error: `checkout service returned non-JSON (${upstream.status}): ${upstreamText.slice(0, 200)}`,
      }, 502);
    }

    if (!upstream.ok) {
      return json(payload ?? { error: `checkout failed (${upstream.status})` }, upstream.status);
    }

    if (!payload?.clientSecret && !payload?.stub) {
      return json({ error: 'checkout service returned an incomplete response' }, 502);
    }

    return json(payload, 201);
  } catch (err: any) {
    return json({ error: `internal error: ${err?.message || 'unknown'}` }, 500);
  }
}

function resolveAppBackendUrl(locals: any): string {
  const fromImportMeta = (import.meta.env as any)?.APP_BACKEND_URL;
  const fromRuntimeEnv = locals?.runtime?.env?.APP_BACKEND_URL;
  const raw = fromImportMeta || fromRuntimeEnv || DEFAULT_APP_BACKEND_URL;
  return String(raw).replace(/\/$/, '');
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}
