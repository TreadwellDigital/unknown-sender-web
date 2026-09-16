// TEMPORARY: reduced-to-nothing version to isolate the 502 cause.
// Once we've confirmed the endpoint responds without an upstream fetch,
// we'll add the proxy logic back piece by piece.

export const prerender = false;

export async function POST({ request }: { request: Request }) {
  try {
    const body = await request.json().catch(() => null);
    return new Response(
      JSON.stringify({ ok: true, echo: body, ts: Date.now() }),
      { status: 200, headers: { 'content-type': 'application/json' } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err?.message || 'unknown' }),
      { status: 500, headers: { 'content-type': 'application/json' } }
    );
  }
}
