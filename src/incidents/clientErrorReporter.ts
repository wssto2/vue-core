import type { ApplicationErrorReport } from "../app";
import { defaultOnError } from "../app/application";
import { isApiError, RECENT_REQUEST_IDS, type HttpClient } from "../client";
import { incidentRoutes } from "../modules/incident/routes";
import type { ClientErrorInput } from "../modules/incident/schemas";

export interface ClientErrorReporterOptions {
  /** The application's platform: its client sends the report and remembers the request ids; its session says whether anybody is signed in. */
  platform: { readonly http: HttpClient; readonly session: { readonly state: { readonly value: { readonly status: string } } } };
  /** The version of the build, sent with every report (the server keeps 100 characters). Default: none. */
  appVersion?: string;
  /** What the application did with its errors before (the second half of a chain). Default: the library's console line. */
  onError?: (report: ApplicationErrorReport) => void;
  /** The origin whose scripts count as the application's own. Default: the page's. */
  origin?: string;
}

// The bounds of go-core's `ClientErrorInput`: a longer text is cut, never refused.
const MESSAGE_MAX = 2000;
const STACK_MAX = 20000;
const ROUTE_MAX = 255;
const BROWSER_MAX = 500;
const VERSION_MAX = 100;
const REQUEST_ID_MAX = 100;
const DETAIL_MAX = 255;
/** The most distinct errors one page session reports: a loop that throws something new each time stops here. */
export const MAX_REPORTS_PER_SESSION = 20;

const SOURCES: ReadonlySet<ApplicationErrorReport["source"]> = new Set(["vue", "unhandledrejection", "window", "handled"]);
const cut = (text: string, max: number) => text.slice(0, max);
// `Script error.` is all a browser tells about a script of another origin.
const isOpaque = (message: string) => /^script error\.?$/i.test(message.trim());
// The first line of a stack that is a frame (Chrome: `at fn (url:1:2)`, Firefox and Safari: `fn@url:1:2`), not the message above it.
const topFrame = (stack: string) => stack.split("\n").find((line) => /^\s*at\s|@\S/.test(line))?.trim() ?? "";

/**
 * Reports the errors the browser hits in the application's own code to go-core's incident module
 * (`POST /v1/incidents/client-errors`), where they join the incidents as one per error with a rising count. Pass it to
 * `createApplication({ onError })`; it also hands every report on to `onError` (the console line by default), so nothing is lost.
 *
 *   createApplication({ platform, features, onError: clientErrorReporter({ platform, appVersion: __APP_VERSION__ }) })
 *
 * Reported: component errors, unhandled rejections, window errors and errors the code handled itself (`report` of the application,
 * sent with `source: "handled"` and its `detail`) that carry a real `Error` whose stack has a frame of the
 * application's own origin. Not reported: failed requests (`ApiError`, of any kind: the server captures its own 5xx),
 * `Script error.`, errors of extensions and other origins, failures of effects, loads and the router, and anything while nobody
 * is signed in. Each error (message plus top frame) goes once per page session, at most 20 distinct ones. A report sends the message,
 * the stack, the route's path (no query), the browser, the version and the ids of the last requests the client made, which link
 * the error to the server's incident of a failing call. Sending never throws, is never awaited and never reports its own failure.
 */
export function clientErrorReporter(options: ClientErrorReporterOptions): (report: ApplicationErrorReport) => void {
  const { platform, appVersion = "", onError = defaultOnError } = options;
  const seen = new Set<string>();

  function send(report: ApplicationErrorReport): void {
    const { error } = report;
    if (!SOURCES.has(report.source) || !(error instanceof Error) || isApiError(error)) return;
    if (error.message.trim() === "" || isOpaque(error.message)) return;
    const origin = options.origin ?? globalThis.location?.origin;
    const stack = error.stack ?? "";
    if (!origin || origin === "null" || !stack.includes(`${origin}/`)) return;
    if (platform.session.state.value.status !== "authenticated") return;
    const fingerprint = `${error.message}\n${topFrame(stack)}`;
    if (seen.has(fingerprint) || seen.size >= MAX_REPORTS_PER_SESSION) return;
    seen.add(fingerprint);

    const input: ClientErrorInput = {
      message: cut(error.message, MESSAGE_MAX),
      source: report.source,
      ...(report.detail && { detail: cut(report.detail, DETAIL_MAX) }),
      stack: cut(stack, STACK_MAX),
      route: cut((report.route ?? "").split(/[?#]/)[0] ?? "", ROUTE_MAX),
      browser: cut(globalThis.navigator?.userAgent ?? "", BROWSER_MAX),
      app_version: cut(appVersion, VERSION_MAX),
      request_ids: platform.http.recentRequestIds().slice(-RECENT_REQUEST_IDS).map((id) => cut(id, REQUEST_ID_MAX)),
    };
    // A refused or lost report is dropped: it must not become an error of its own (the loop it would start is the one thing to avoid).
    void platform.http.request(incidentRoutes.clientError, input).catch(() => undefined);
  }

  return (report) => {
    try {
      send(report);
    } catch {
      // a reporter that fails stays silent
    }
    onError(report);
  };
}
