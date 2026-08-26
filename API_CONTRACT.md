# Unknown Sender — Site ↔ App API contract

This document describes the HTTP interface between the marketing site
(`unknownsender.co.uk`, Astro on Cloudflare Pages) and the game app
backend (`api.unknownsender.co.uk`).

Endpoints below reflect what the app currently returns (confirmed
against `https://api.unknownsender.co.uk/api/games` and
`https://api.unknownsender.co.uk/api/leaderboard/{id}`), plus three
small additions we're asking the app team to make — flagged inline
as **REQUESTED**.

---

## Ownership summary

### Live games — app is source of truth for:

- Game metadata: name, description (mission briefing), location, coordinates, price tiers, what-to-expect bullets
- Leaderboard scores: every completed session

### Coming-soon games — site-only

The app does **not** know about coming-soon games. Apple App Review
doesn't allow placeholder / "coming soon" content in shipped apps, so
the app is only aware of live games. On the site, coming-soon games
exist as marketing entries (title + tagline + status flag) in
Markdown and are shown on the games index as "Soon" cards.

When a game transitions from coming-soon → live:

1. App team adds it to the app admin (mission briefing, tiers, etc.)
2. Site flips its Markdown `status` flag from `coming-soon` to `live`
3. Site starts calling `GET /api/games` and picking it out by slug
4. App team's content becomes the source of truth for it from that moment

### Site is source of truth for (both live and coming-soon):

- The atmospheric **tagline** per game (short one-liner used on hero + card contexts where the full description is too long)
- **Hero imagery** per game (mobile + desktop crops)
- Marketing copy on non-game pages (home, before-you-play, refunds, terms, privacy)
- Bookings records for its own reconciliation (Supabase, populated by the site's Stripe webhook)

---

## Base URL

```
APP_BACKEND_URL=https://api.unknownsender.co.uk
```

All read endpoints below live under `/api/`, relative to this base.

For writes (booking notifications from site → app), the site uses a
separate URL that the app team can point wherever suits:

```
APP_BACKEND_BOOKING_URL=https://api.unknownsender.co.uk/api/bookings
APP_BACKEND_WEBHOOK_SECRET=<HMAC signing secret>
```

---

## Authentication

Read endpoints are **public** (no auth). Response payloads must not
leak any information that isn't already public — no player emails, no
booking codes, no PII beyond team names as entered by players.

---

## CORS

Read endpoints are fetched from the browser (leaderboard is a
client-side fetch). Please respond with:

```
Access-Control-Allow-Origin: https://unknownsender.co.uk
Access-Control-Allow-Methods: GET, OPTIONS
```

For local dev also allow `http://localhost:4321`. Wildcard `*` is
acceptable if simpler.

---

## Endpoints

### `GET /api/games`

Returns the full games catalogue as a flat array. Site fetches this
once per render (cache below), picks out the game it needs by slug.

**Confirmed response shape (Last Call, as of first draft):**

```json
[
  {
    "id": "6d4d9c34-56fb-4a52-8b49-947e4c9c404c",
    "name": "Last Call",
    "description": "You were never supposed to receive Jack Turner's final message. After a night out in Leeds ends in a disappearance, a stranger warns you to delete the evidence and walk away. Follow the clues, question everyone, and uncover what really happened before the truth disappears for good.",
    "location": "Leeds",
    "latitude": null,
    "longitude": null,
    "tiers": [
      {
        "id": "a98ded33-9853-4f11-99f0-816dae4f7aad",
        "label": "1 to 3 players",
        "minPlayers": 1,
        "maxPlayers": 3,
        "price": 30.0
      },
      {
        "id": "6317ec84-9ef2-451e-b59a-c2c8a39a340b",
        "label": "4 to 6 players",
        "minPlayers": 4,
        "maxPlayers": 6,
        "price": 50.0
      }
    ],
    "whatToExpectPoints": [
      "Receive messages, and evidence from characters in real time",
      "Investigate Leeds landmarks to uncover hidden clues",
      "Analyse voice notes, videos, and conversations to separate truth from lies",
      "Explore the city as you retrace Jack Turner's final movements",
      "Decide who to trust, every suspect has something to hide"
    ]
  }
]
```

**Fields:**

| Field                        | Type          | Notes                                                                                                       |
| ---------------------------- | ------------- | ----------------------------------------------------------------------------------------------------------- |
| `id`                         | UUID          | Internal app identifier                                                                                     |
| `name`                       | string        | Display title                                                                                               |
| `description`                | string        | Mission briefing body — full paragraph, plain text                                                          |
| `location`                   | string        | Display city name (e.g. `"Leeds"`)                                                                          |
| `latitude` / `longitude`     | number, null  | Start location coordinates for map. Nullable                                                                |
| `tiers`                      | array         | Price tiers, one per team size                                                                              |
| `tiers[].id`                 | UUID          | Tier identifier — site sends this in booking metadata                                                       |
| `tiers[].label`              | string        | Display label (e.g. `"1 to 3 players"`)                                                                     |
| `tiers[].minPlayers`         | integer       | Min team size for this tier                                                                                 |
| `tiers[].maxPlayers`         | integer       | Max team size for this tier                                                                                 |
| `tiers[].price`              | number        | **Price in pence, as a float**. `30.0` = £0.30. Confirmed against app UI                                    |
| `whatToExpectPoints`         | string[]      | Bullet list rendered as a "What to expect" section                                                          |

#### REQUESTED additions

The site needs three more fields on this response before we can
switch fully off the current placeholder Markdown:

| Field                        | Type    | Purpose                                                                                                                                                    |
| ---------------------------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `slug`                       | string  | URL-safe identifier (e.g. `"last-call"`). Site uses this to map its `/games/{slug}` routes to the app's game record. See notes below.                      |
| `published`                  | boolean | Whether the game should be visible on the public site. The current response mixes real games (Last Call) with test data (Pub Quiz, Sam TEST 2, etc.). Site would filter to `published: true`. |
| `tiers[].stripePriceId`      | string  | The Stripe `price_...` id the site passes to Checkout. Without this, the site has to inline `price_data` at checkout time (works, but you can't manage prices from Stripe's dashboard after the fact). |

**Notes on `slug`:**

Site URLs are `/games/last-call`, not `/games/{uuid}`, for SEO and
shareability. Slug should match the site's Markdown filename for the
game — e.g. `last-call` for the game currently named "Last Call".
Should be lowercase, hyphen-separated, letters and digits only.

**Notes on `published`:**

Some sort of visibility flag or channel is needed so the app admin
can create WIP entries without them appearing on the public site.
`published: boolean` is the simplest — anything else (draft / staged /
scheduled) works too, so long as the site can filter.

**Alternative if you'd prefer a different shape:**

Rather than adding fields to the same endpoint, you could expose two
endpoints — `GET /api/games` (staff view, everything) and
`GET /api/games/public` (only published + only fields the site needs).
Either way works; up to you.

---

### `GET /api/leaderboard/{gameId}`

Returns a paginated leaderboard for a game, sorted by fastest
completion time by default.

**Confirmed response shape:**

```json
{
  "content": [
    {
      "rank": 1,
      "teamId": "d854df47-3725-4c84-8172-9aa9a175924b",
      "teamName": "A",
      "scoreTimeSeconds": 31,
      "completedAt": "2026-05-05T11:20:51.173664Z",
      "memberCount": 1
    }
  ],
  "page": 0,
  "size": 20,
  "totalElements": 14,
  "totalPages": 1
}
```

**Path parameter:** `gameId` is the game's `id` (UUID) from the games
endpoint.

**Query parameters:**

| Param    | Type    | Default        | Notes                                                                          |
| -------- | ------- | -------------- | ------------------------------------------------------------------------------ |
| `page`   | integer | 0              | 0-indexed page                                                                 |
| `size`   | integer | 20             | Entries per page                                                               |
| `search` | string  | none           | Case-insensitive substring match on team name                                  |
| `sort`   | string  | `scoreTimeSeconds` | Sort column — confirmed working with `teamName`, `completedAt`             |
| `order`  | enum    | `asc`          | `asc` or `desc`                                                                |

**Content fields:**

| Field                | Type    | Notes                                                                       |
| -------------------- | ------- | --------------------------------------------------------------------------- |
| `rank`               | integer | Pre-calculated 1-based rank across the full sorted list                     |
| `teamId`             | UUID    | Not currently used by the site; kept for future linking                     |
| `teamName`           | string  | As entered at checkout                                                      |
| `scoreTimeSeconds`   | integer | Completion time in seconds — the site formats this as HH:MM:SS for display  |
| `completedAt`        | ISO8601 | UTC timestamp of when the session finished                                  |
| `memberCount`        | integer | Number of players in the team                                               |

---

## Caching

Site edge-caches the games response for **60 seconds** and the
leaderboard for **30 seconds**. Both endpoints reportedly cache
in-process for a few seconds — that's fine, we cache at our edge
independently.

If prices need to update instantly, respond with
`Cache-Control: no-store` on `/api/games` and we'll bypass edge cache.

---

## Booking notification (site → app, existing)

When a Stripe Checkout Session completes, the site's
`/api/stripe-webhook` route POSTs to `APP_BACKEND_BOOKING_URL` with an
HMAC-signed payload:

```json
{
  "event": "booking.created",
  "booking_code": "US-4X7T-9K2M",
  "game_id": "6d4d9c34-56fb-4a52-8b49-947e4c9c404c",
  "tier_id": "a98ded33-9853-4f11-99f0-816dae4f7aad",
  "team_name": "The Suspects",
  "buyer_email": "player@example.com",
  "expires_at": "2026-11-01T00:00:00Z",
  "created_at": "2026-08-01T14:32:00Z",
  "stripe_session_id": "cs_live_..."
}
```

Header: `x-signature: <hex sha256 hmac of the raw body, using APP_BACKEND_WEBHOOK_SECRET>`.

The app should:

1. Verify the HMAC signature (reject on mismatch).
2. Look up the game by `game_id`, the tier by `tier_id`.
3. Provision the player-side booking, keyed by `booking_code`.
4. Respond `200 OK` on success. Non-2xx triggers Stripe's webhook retry.

---

## Open questions for the app team

1. **The three REQUESTED additions above** — `slug`, `published`, `tiers[].stripePriceId`. Any concerns / different preferences?
2. **Rate limits** — any expected caps we should design around?
3. **Timezones** — `completedAt` is currently UTC ISO8601. Confirm this is intentional (it is what the site expects).
4. **`price` as float in pence** — this works, just checking it's deliberate rather than a data-type accident. Integer pence would be marginally safer against float rounding for future currency ops, but not blocking.
5. **Coordinates on Last Call are null** — should default coords be set at some point? Otherwise the site's map will show a UK-wide view rather than centring on the game.
