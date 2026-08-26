/**
 * POST /api/stripe-webhook
 *
 * Stripe posts here when a payment event happens. On checkout.session.completed
 * we:
 *   1. Verify the request signature (never trust an unverified webhook)
 *   2. Generate a booking code
 *   3. Insert a row into Supabase `bookings` (using the service_role key)
 *   4. POST a signed payload to the game app backend so it can provision the player
 *   5. Fire a Brevo transactional email with the booking code + play instructions
 *
 * All the env vars needed are documented in .env.example.
 *
 * ⚠️  This route MUST NOT be prerendered. Stripe needs a real endpoint.
 */

import type { APIRoute } from 'astro';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  const secretKey = import.meta.env.STRIPE_SECRET_KEY;
  const webhookSecret = import.meta.env.STRIPE_WEBHOOK_SECRET;
  if (!secretKey || !webhookSecret) {
    console.error('Stripe env vars not set');
    return new Response('server not configured', { status: 500 });
  }

  const stripe = new Stripe(secretKey, {
    apiVersion: '2024-11-20.acacia' as any,
  });

  // Read raw body for signature verification
  const sig = request.headers.get('stripe-signature');
  if (!sig) return new Response('missing signature', { status: 400 });
  const rawBody = await request.text();

  let event: Stripe.Event;
  try {
    // constructEventAsync uses Web Crypto — works on Cloudflare Workers
    event = await stripe.webhooks.constructEventAsync(rawBody, sig, webhookSecret);
  } catch (err: any) {
    console.error('Stripe signature verification failed:', err.message);
    return new Response(`invalid signature: ${err.message}`, { status: 400 });
  }

  // We only care about completed checkouts for now
  if (event.type !== 'checkout.session.completed') {
    return new Response('ignored', { status: 200 });
  }

  const session = event.data.object as Stripe.Checkout.Session;
  const meta = session.metadata ?? {};
  const gameSlug = meta.gameSlug;
  const tierId = meta.tierId;
  const teamName = meta.teamName;
  const email = session.customer_email ?? session.customer_details?.email ?? null;

  if (!gameSlug || !tierId || !teamName || !email) {
    console.error('missing metadata / email on session', session.id);
    return new Response('missing fields', { status: 400 });
  }

  // --- Generate booking code ---
  const bookingCode = generateBookingCode();

  // --- Insert into Supabase bookings ---
  const sbUrl = import.meta.env.PUBLIC_SUPABASE_URL;
  const sbServiceKey = import.meta.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!sbUrl || !sbServiceKey) {
    console.error('Supabase env vars not set');
    return new Response('server not configured', { status: 500 });
  }
  const sb = createClient(sbUrl, sbServiceKey, {
    auth: { persistSession: false },
  });

  const now = new Date();
  const validityDays = 90; // TODO: pull from game.data.validityDays
  const expiresAt = new Date(now.getTime() + validityDays * 24 * 60 * 60 * 1000);

  const { error: insertErr } = await sb.from('bookings').insert({
    booking_code: bookingCode,
    game_slug: gameSlug,
    tier_id: tierId,
    team_name: teamName,
    buyer_email: email,
    stripe_session_id: session.id,
    amount_paid_pence: session.amount_total ?? 0,
    currency: session.currency ?? 'gbp',
    status: 'paid',
    created_at: now.toISOString(),
    expires_at: expiresAt.toISOString(),
  });
  if (insertErr) {
    console.error('booking insert failed:', insertErr);
    // Return 500 so Stripe retries the webhook
    return new Response('db insert failed', { status: 500 });
  }

  // --- POST to game app backend ---
  const appUrl = import.meta.env.APP_BACKEND_BOOKING_URL;
  const appSecret = import.meta.env.APP_BACKEND_WEBHOOK_SECRET;
  if (appUrl && appSecret) {
    try {
      const payload = {
        event: 'booking.created',
        booking_code: bookingCode,
        game_slug: gameSlug,
        tier_id: tierId,
        team_name: teamName,
        buyer_email: email,
        expires_at: expiresAt.toISOString(),
        created_at: now.toISOString(),
        stripe_session_id: session.id,
      };
      const payloadStr = JSON.stringify(payload);
      const signature = await hmacSha256(payloadStr, appSecret);
      await fetch(appUrl, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-signature': signature,
        },
        body: payloadStr,
      });
    } catch (err) {
      console.error('app backend notification failed (non-fatal):', err);
      // Non-fatal: booking is already in DB; app can reconcile later.
    }
  } else {
    console.warn('APP_BACKEND_BOOKING_URL not set — skipping app notification');
  }

  // --- Send Brevo transactional confirmation email ---
  const brevoKey = import.meta.env.BREVO_API_KEY;
  if (brevoKey) {
    try {
      await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'api-key': brevoKey,
        },
        body: JSON.stringify({
          sender: { name: 'Unknown Sender', email: 'hello@unknownsender.co.uk' },
          to: [{ email }],
          subject: `Booking confirmed — ${bookingCode}`,
          htmlContent: `
            <p>Your booking is in.</p>
            <p><strong>Booking code:</strong> ${bookingCode}</p>
            <p><strong>Team:</strong> ${escapeHtml(teamName)}</p>
            <p>You have 90 days to play. Read the safety brief before you set out: <a href="https://unknownsender.co.uk/before-you-play">Before you play</a>.</p>
            <p>— Unknown Sender</p>
          `,
        }),
      });
    } catch (err) {
      console.error('Brevo email failed (non-fatal):', err);
    }
  } else {
    console.warn('BREVO_API_KEY not set — skipping confirmation email');
  }

  return new Response('ok', { status: 200 });
};

// --- Helpers ---

function generateBookingCode(): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // omitted I, L, O, 0, 1 to avoid confusion
  const pick = () => chars[Math.floor(Math.random() * chars.length)];
  const block = () => `${pick()}${pick()}${pick()}${pick()}`;
  return `US-${block()}-${block()}`;
}

async function hmacSha256(payload: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(payload));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string)
  );
}
