// A stand-in for Playwright's `Page`, so the mocks are tested without a browser: it records the `route()` registrations and answers a
// request through them the way Playwright does (the last registered match first, `fallback()` to the next). Not shipped.
import type { Page, Route } from "@playwright/test";
import type { Answer } from "./envelope";

export interface Reply {
  readonly status: number;
  readonly contentType: string | undefined;
  readonly text: string;
  /** The body parsed as JSON (undefined for an empty body or an event stream). */
  readonly json: unknown;
}

type Handler = (route: Route) => unknown;
type Pattern = string | RegExp;

// Playwright's glob: `**` crosses slashes, `*` does not.
const matcher = (pattern: Pattern): RegExp =>
  pattern instanceof RegExp ? pattern : new RegExp(`^${pattern.replace(/[.+^$()|[\]\\]/g, "\\$&").replace(/\*\*\/?/g, "\uE000").replace(/\*/g, "[^/]*").replace(/\uE000/g, ".*")}$`);

export function stubPage() {
  const routes: { pattern: Pattern; match: RegExp; handler: Handler }[] = [];
  const page = { route: async (pattern: Pattern, handler: Handler) => void routes.push({ pattern, match: matcher(pattern), handler }) } as unknown as Page;

  /** Sends a request through the registered routes; undefined when none of them fulfilled it (the network would). */
  async function request(method: string, path: string, body?: unknown): Promise<Reply | undefined> {
    const url = `http://localhost${path}`;
    const matching = routes.filter((candidate) => candidate.match.test(url)).reverse();
    let reply: Reply | undefined;

    for (const candidate of matching) {
      let fell = false;
      const route = {
        request: () => ({ method: () => method, url: () => url, postData: () => (body === undefined ? null : JSON.stringify(body)), postDataJSON: () => body }),
        fulfill: async (answer: Answer = {}) => {
          const text = typeof answer.body === "string" ? answer.body : "";
          reply = { status: answer.status ?? 200, contentType: answer.contentType, text, json: answer.contentType === "application/json" ? JSON.parse(text) : undefined };
        },
        fallback: async () => void (fell = true),
      } as unknown as Route;
      await candidate.handler(route);
      if (!fell) return reply;
    }
    return undefined;
  }

  return { page, request, patterns: () => routes.map((candidate) => candidate.pattern) };
}
