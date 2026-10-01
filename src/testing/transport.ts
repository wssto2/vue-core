import type { Transport } from "../client";

/** One request a fake transport received. */
export interface RecordedCall {
  /** The URL as the client sent it, with the API base and the query string. */
  readonly url: string;
  /** Upper case; `GET` when the client set none. */
  readonly method: string;
  readonly headers: Headers;
  /** The request as `fetch` received it (body, signal). */
  readonly init: RequestInit;
}

/** What a fake transport answers: a response (served again for every matching call), a failure to throw, or a function of the call. */
export type Answer = Response | Error | ((call: RecordedCall) => Response | Promise<Response>);

/** A JSON response, as go-core answers: `jsonResponse(404, { error: "…" })`. A body of `undefined` is an empty one (204). */
export const jsonResponse = (status: number, body?: unknown, headers: Record<string, string> = {}): Response =>
  new Response(body === undefined ? null : JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...headers } });

const record = (url: string, init: RequestInit): RecordedCall => ({
  url,
  method: (init.method ?? "GET").toUpperCase(),
  headers: new Headers(init.headers),
  init,
});

async function answer(next: Answer, call: RecordedCall): Promise<Response> {
  if (next instanceof Error) throw next;
  return typeof next === "function" ? next(call) : next.clone(); // a repeated answer must be readable again
}

/**
 * A transport answering from a queue, one answer per call in order (the last one repeats), and
 * recording what it was sent. For a test about a sequence: a retry, a 401 then a renewal, a race.
 *
 *   const { transport, calls } = scriptedTransport(jsonResponse(503, {}), jsonResponse(200, { id: 1 }));
 */
export function scriptedTransport(...answers: Answer[]): { transport: Transport; calls: RecordedCall[] } {
  const calls: RecordedCall[] = [];
  const queue = [...answers];
  const transport: Transport = async (url, init) => {
    const call = record(url, init);
    calls.push(call);
    const next = queue.length > 1 ? queue.shift() : queue[0];
    if (next === undefined) throw new Error("scriptedTransport: no answer left");
    return answer(next, call);
  };
  return { transport, calls };
}

/**
 * A transport answering by route, whatever the order: keys are `"METHOD /path"` (the path with the
 * API base, the query string optional: `"GET /api/v1/tickets"` matches `/api/v1/tickets?page=2` unless a
 * key with that exact query exists). A request nothing matches fails the test with the routes it
 * knows, so a view that asks for something unexpected is never answered by accident.
 *
 *   const { transport, calls } = routedTransport({
 *     "GET /tickets": jsonResponse(200, { data: [] }),
 *     "POST /tickets": (call) => jsonResponse(201, { id: 7 }),
 *   });
 */
export function routedTransport(routes: Readonly<Record<string, Answer>>): { transport: Transport; calls: RecordedCall[] } {
  const calls: RecordedCall[] = [];
  const transport: Transport = async (url, init) => {
    const call = record(url, init);
    calls.push(call);
    const { pathname, search } = new URL(url, "http://test.invalid");
    const next = routes[`${call.method} ${pathname}${search}`] ?? routes[`${call.method} ${pathname}`];
    if (next === undefined) throw new Error(`routedTransport: no route for ${call.method} ${pathname}${search}; it has ${Object.keys(routes).join(", ") || "none"}`);
    return answer(next, call);
  };
  return { transport, calls };
}
