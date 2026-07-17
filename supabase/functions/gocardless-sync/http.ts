// Request-Parsing für gocardless-sync, wie ownership.ts bewusst Deno-frei
// gehalten, damit es per Vitest testbar ist (__tests__/ownership.test.ts).

export async function parseJsonBody(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    // Die rohe SyntaxError-Message enthält den Anfang des Request-Bodys —
    // die darf nicht zurück an den Client reflektiert werden.
    const err = new Error("invalid JSON body") as Error & { status: number };
    err.status = 400;
    throw err;
  }
}
