// Test helpers for this folder: imported by tests only; the declaration build excludes it.
import type { Transport } from "./transport";

export interface Call {
  url: string;
  init: RequestInit;
  headers: Headers;
}

export const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(body === undefined ? null : JSON.stringify(body), { status, headers });

/** A transport answering from a queue (a function answers every call) and recording what it was sent. */
export function scripted(...answers: (Response | Error | (() => Response | Promise<Response>))[]) {
  const calls: Call[] = [];
  const queue = [...answers];
  const transport: Transport = async (url, init) => {
    calls.push({ url, init, headers: new Headers(init.headers) });
    const next = queue.length > 1 ? queue.shift() : queue[0];
    if (next === undefined) throw new Error("scripted transport: no answer left");
    if (next instanceof Error) throw next;
    return typeof next === "function" ? next() : next.clone(); // a repeated answer must be readable again
  };
  return { transport, calls };
}
