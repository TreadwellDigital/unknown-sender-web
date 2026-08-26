# Unknown Sender — Website

Marketing site + booking flow for Unknown Sender.
Built with Astro (SSR on Cloudflare Pages) + Supabase + Stripe Checkout.

## Stack

- **Astro 5** — content pages, server-rendered API routes, deployed to Cloudflare Pages
- **Supabase** — Postgres database for bookings + public leaderboard scores
- **Stripe Checkout** — hosted payments (single-item, whole-team ticket)
- **Brevo** — transactional confirmation emails
- **Google Tag Manager** — analytics + marketing pixels, gated behind Consent Mode v2

## Getting started

Install dependencies:

```bash
npm install
```

Copy the env template and fill in the values you have:

```bash
cp .env.example .env
```

Run the dev server:

```bash
npm run dev
```

The site will be available at `http://localhost:4321`.

## Project structure

```
src/
├── content/          # Games + cities as Markdown (content collections)
│   ├── config.ts     # Schemas
│   ├── games/        # One file per game (last-call.md, etc.)
│   └── cities/       # One file per city (leeds.md, etc.)
├── layouts/
│   └── BaseLayout.astro  # Shared HTML shell (GTM, consent, favicon, fonts)
├── lib/
│   └── supabase.ts       # Supabase browser client
├── pages/
│   ├── index.astro       # Home
│   ├── games/            # /games, /games/[slug], /games/[slug]/leaderboard
│   ├── cities/           # /cities, /cities/[slug]
│   ├── checkout/         # /checkout/success, /checkout/cancelled
│   ├── api/              # Server routes: create-checkout-session, stripe-webhook
│   └── ...               # info, privacy, terms, refunds, before-you-play
├── styles/
│   └── global.css        # Palette, typography, base styles
public/
├── favicon.svg, favicon.ico, favicon-*.png
├── consent.js            # Cookie consent banner (ported from holding page)
├── site.webmanifest
└── images/               # Hero images per game
```

## Content editing (no CMS needed)

Games and cities are Markdown files in `src/content/`. To add a new city:

1. Create `src/content/cities/manchester.md` (frontmatter defines everything)
2. Push. Routes at `/cities/manchester` are generated automatically.

Same for games.

## Deployment

Deploys to Cloudflare Pages via GitHub push. `main` branch = production.

For a one-off manual deploy:

```bash
npm run deploy
```

Environment variables are set in the Cloudflare Pages dashboard, not in `.env` (which is dev-only).

## Integrations to wire up

- [ ] Supabase: run migrations to create `bookings` + `scores` tables
- [ ] Stripe: create the Last Call product + two prices (£40 / £60), set webhook endpoint
- [ ] App backend: agree webhook payload shape, get URL + shared secret
- [ ] Brevo: create transactional template for booking confirmation

See individual files under `src/pages/api/` for wiring points.
