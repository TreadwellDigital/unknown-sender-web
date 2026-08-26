/**
 * POST /api/create-checkout-session
 *
 * Called from the game page when a user clicks "Book". Creates a Stripe
 * Checkout Session for the selected price tier and returns its URL. The
 * client then redirects the user to Stripe's hosted payment page.
 *
 * Body:
 *   { gameSlug: string, tierId: string, teamName: string, email: string }
 *
 * Response:
 *   { url: string } on success
 *   { error: string } on failure (400/500)
 */

import type { APIRoute } from 'astro';
import Stripe from 'stripe';
import { getEntry } from 'astro:content';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { gameSlug, tierId, teamName, email } = body ?? {};

    // --- Validate ---
    if (typeof gameSlug !== 'string' || typeof tierId !== 'string') {
      return json({ error: 'gameSlug and tierId are required' }, 400);
    }
    if (typeof teamName !== 'string' || teamName.trim().length === 0 || teamName.length > 50) {
      return json({ error: 'teamName is required (1–50 characters)' }, 400);
    }
    if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return json({ error: 'valid email is required' }, 400);
    }

    // --- Load game + tier from content collection ---
    const game = await getEntry('games', gameSlug);
    if (!game || game.data.status !== 'live') {
      return json({ error: 'game not found or not available' }, 404);
    }
    const tier = game.data.priceTiers.find((t) => t.id === tierId);
    if (!tier) {
      return json({ error: 'tier not found' }, 400);
    }

    // --- Init Stripe (server-side only) ---
    const secretKey = import.meta.env.STRIPE_SECRET_KEY;
    if (!secretKey) {
      console.error('STRIPE_SECRET_KEY not set');
      return json({ error: 'payments not configured' }, 500);
    }
    const stripe = new Stripe(secretKey, {
      // apiVersion pinned to a known good version; update deliberately.
      apiVersion: '2024-11-20.acacia' as any,
    });

    const siteUrl = import.meta.env.PUBLIC_SITE_URL ?? new URL(request.url).origin;

    // --- Create Checkout Session ---
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      currency: 'gbp',
      customer_email: email,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: 'gbp',
            unit_amount: tier.pricePence,
            product_data: {
              name: `${game.data.title} — ${tier.label}`,
              description: `Unknown Sender · ${game.data.citySlug} · Valid for ${game.data.validityDays} days`,
            },
          },
        },
      ],
      // Everything downstream needs to identify the booking; put it in metadata.
      metadata: {
        gameSlug,
        tierId,
        teamName: teamName.trim(),
      },
      success_url: `${siteUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/checkout/cancelled`,
      // Optional: require reading terms in Stripe Checkout UI too
      consent_collection: {
        terms_of_service: 'required',
      },
      custom_text: {
        terms_of_service_acceptance: {
          message: 'I agree to the [Terms](https://unknownsender.co.uk/terms), [Refund Policy](https://unknownsender.co.uk/refunds), and have read the [Before you play](https://unknownsender.co.uk/before-you-play) brief.',
        },
      },
    });

    if (!session.url) {
      return json({ error: 'no checkout URL returned' }, 500);
    }

    return json({ url: session.url });
  } catch (err: any) {
    console.error('create-checkout-session error:', err);
    return json({ error: err?.message ?? 'internal error' }, 500);
  }
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}
