import { defineCollection, z } from 'astro:content';

/**
 * Games — one Markdown file per game. Renders /games/[slug].
 * Prices here are a fallback used when the app API is unreachable.
 * Once the app backend is live, price + availability are fetched from
 * GET /api/games/[slug] and overlaid on top of this metadata.
 */
const games = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    citySlug: z.string(),
    tagline: z.string(),
    summary: z.string(),
    // Hero images + pricing are only required for status === 'live'.
    // Coming-soon games can skip them; the games index handles both cases.
    heroImageMobile: z.string().optional(),
    heroImageDesktop: z.string().optional(),
    heroImageAlt: z.string().optional(),
    duration: z.string().default('90–120 minutes'),
    ageMin: z.number().default(18),
    validityDays: z.number().default(90),
    status: z.enum(['live', 'coming-soon']).default('live'),
    order: z.number().default(100),
    // If set, the game page shows a waitlist form until this date/time
    // passes, then automatically switches to the real Stripe booking flow.
    // Omit (or set to a past date) to open bookings immediately.
    bookingsOpenAt: z.coerce.date().optional(),
    priceTiers: z
      .array(
        z.object({
          id: z.string(),
          label: z.string(),
          maxPlayers: z.number(),
          pricePence: z.number(),
          stripePriceId: z.string().optional(),
        })
      )
      .default([]),
  }),
});

/**
 * Cities — one Markdown file per city. Not currently rendered as its
 * own route (we're launching in one city only). Referenced by games
 * via citySlug so the game page can show the city name. When we open
 * additional cities, restore src/pages/cities/[slug].astro to expose
 * per-city landing pages again.
 */
const cities = defineCollection({
  type: 'content',
  schema: z.object({
    name: z.string(),
    tagline: z.string().optional(),
    status: z.enum(['live', 'coming-soon']),
    order: z.number().default(100),
  }),
});

export const collections = { games, cities };
