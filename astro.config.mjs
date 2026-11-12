// @ts-check
import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';

// https://astro.build/config
export default defineConfig({
  site: 'https://unknownsender.co.uk',
  output: 'server',
  adapter: cloudflare({
    platformProxy: {
      enabled: true,
    },
  }),
  // 301s from the old /games/* URLs to the new top-level game URLs,
  // so existing links and search-engine bookmarks don't break.
  // `/games` (the all-games listing) stays where it is.
  redirects: {
    '/games/[slug]': { status: 301, destination: '/[slug]' },
    '/games/[slug]/leaderboard': { status: 301, destination: '/[slug]/leaderboard' },
  },
});
