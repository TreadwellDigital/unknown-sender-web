// Minimum-viable API endpoint for diagnosing whether Astro API routes
// are being included in the deployed worker bundle at all. No imports,
// no logic — if THIS 404s, something's structurally wrong with the
// adapter/build. If it responds, the issue is inside checkout.ts.

export const prerender = false;

export async function GET() {
  return new Response(JSON.stringify({ ok: true, ts: Date.now() }), {
    headers: { 'content-type': 'application/json' },
  });
}

export async function POST() {
  return new Response(JSON.stringify({ ok: true, method: 'POST', ts: Date.now() }), {
    headers: { 'content-type': 'application/json' },
  });
}
