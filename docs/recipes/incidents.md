# Recipe: incidents and error reports

go-core's incident module is the application's error log: every server error becomes an incident (repeats are counted on it), a person can report a bug, the browser can report its own errors, and the people who run the application see the list, work on the incidents and are told of the new ones. `incidentsFeature()` is its screens, in `@wssto2/vue-core/incidents`, and `clientErrorReporter()` is the half that sends the browser's errors.

<!-- example: docs/examples/incidents/main.ts -->
```ts
// The composition root of an application with the incident screens: sign-in, the incidents, and the browser's own errors reported to them.
import { createApplication } from "@wssto2/vue-core/app";
import { identityFeature, identityPlatform } from "@wssto2/vue-core/identity";
import { clientErrorReporter, incidentsFeature } from "@wssto2/vue-core/incidents";
import { createPlatform, readBootstrap } from "@wssto2/vue-core/platform";
import { backofficeShell } from "@wssto2/vue-core/shell";

declare const __APP_VERSION__: string; // the build's version, defined by the bundler

const platform = createPlatform({ config: readBootstrap(), ...identityPlatform() });

void createApplication({
  platform,
  shell: backofficeShell(),
  features: [
    identityFeature({ home: "/" }),
    // `destination` is the node of the server's menu that opens the list; `appVersion` is filled into every report a person files.
    incidentsFeature({ destination: "incidents.index", appVersion: __APP_VERSION__ }),
  ],
  // Errors the browser hits in the application's own code become incidents (low severity, one per error); the console line stays.
  onError: clientErrorReporter({ platform, appVersion: __APP_VERSION__ }),
}).mount("#app");
```

The server side is `incident.Install(...)` in go-core (v1.11.0 or later), which also defines the four permissions. Install the feature for everyone: the server's catalogue decides who sees what.

## The screens

| Permission | Gives |
|---|---|
| `incident:view` | the list (`/incidents`, route `incidents.index`) and an incident (`/incidents/:incidentID`, `incidents.details`) |
| `incident:create` | *Report a bug* (the account menu, and the list's primary action) and comments |
| `incident:update` | the management form on an incident |
| `incident:manage` | the staff: every incident (anybody else sees the ones they reported, wrote a report on or watch), internal comments, the advanced fields of a report, and the alerts |

**The list** shows the incidents last seen first, with the code, severity, status, source (server error, browser error, user report, or mixed), the number of reports and occurrences, and filters on date, status, severity and source. A row opens the incident, with previous / next within the list's result set.

**An incident** shows what happened (module, route, error, stack), the reports people filed on it, its comments (an internal one is marked, and only the staff write them), a summary (source, first and last seen, count, reporter, assignee, external ticket) and, for whoever holds `incident:update`, the management form: status, severity, who may see it, the resolution and the external ticket. The people are shown by name and e-mail.

**Report a bug** is a dialog with a title, what happened and how bad it is; the page and the browser are filled in, and the version is the feature's `appVersion`. The staff also see the advanced fields (module, steps, expected and actual result, the browser's error). A report of a problem that is already open joins its incident, and the dialog from the list then opens it.

## Reporting the browser's errors

`clientErrorReporter({ platform, appVersion?, onError? })` is a handler for `createApplication({ onError })`. It posts to `POST /v1/incidents/client-errors` and hands every report on to `onError` (the console line by default), so nothing is lost.

- **Reported:** component errors, unhandled rejections and window errors that carry a real `Error` whose stack has a frame of the application's own origin.
- **Handled errors:** `application.report(error, { detail })` (or `useApplication().report` in setup) is for a failure the code caught and the user saw: it goes through `onError` as `source: "handled"` and is reported like the others, with the same rules. go-core's `ClientErrorInput` has no field for the source or the detail, so the report's message starts `[handled: detail] `.
- **Not reported:** failed requests (`ApiError`, of any kind: the server captures its own 5xx), `Script error.`, errors of extensions and other origins, failures of effects, loads and the router, and anything while nobody is signed in.
- **Once per page session:** an error is told apart by its message and top stack frame; at most 20 distinct ones per session. The server groups the same error into one incident with a rising count and rate-limits each person.
- **What it sends:** the message, the stack, the route's path (no query), the browser, the version, and the request ids of the last 20 requests the client made (`http.recentRequestIds()`), which link the error to the server's incident of a failing call. Every field is cut to the server's bound.
- **Never a problem of its own:** sending is not awaited, never throws, and a refused or lost report is dropped, not reported, so it cannot loop.

A production build's stacks are minified. Build with hidden source maps (`build.sourcemap: "hidden"`) and keep the maps with the release; nothing decodes them for you.
