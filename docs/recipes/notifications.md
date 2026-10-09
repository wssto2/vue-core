# Recipe: notifications

go-core's notification module is the in-app inbox: what a person finds when they open the application, read on one device and read on all of them. `notificationsFeature()` is its screens, in `@wssto2/vue-core/notifications`, next to [`identityFeature()`](sign-in.md): the bell with the unread count, the inbox it opens, the live stream behind both, the person's own notification settings (e-mail per category, quiet hours), and a page of the events that failed.

<!-- example: docs/examples/notifications/main.ts -->
```ts
// The composition root of an application with in-app notifications: sign-in, then the bell and the dead-letters page.
import { createApplication } from "@wssto2/vue-core/app";
import { identityFeature, identityPlatform } from "@wssto2/vue-core/identity";
import { notificationsFeature } from "@wssto2/vue-core/notifications";
import { createPlatform, readBootstrap } from "@wssto2/vue-core/platform";
import { backofficeShell } from "@wssto2/vue-core/shell";

const platform = createPlatform({ config: readBootstrap(), ...identityPlatform() });

void createApplication({
  platform,
  shell: backofficeShell(),
  features: [
    identityFeature({ home: "/" }),
    notificationsFeature({
      // The categories go-core's `notification.Install` registered, drawn with an icon and a colour. Without an entry: the bell on a neutral tile.
      categories: { "tickets.assigned": { icon: "user3Line", hue: "blue" }, "system.test": { icon: "checkCircle", hue: "teal" } },
      // `destination` is the node of the server's menu that opens the page; `false` leaves the page out.
      deadLetters: { destination: "events.deadletters" },
      // The person's own settings page (default true): see "Notification settings"; their names come from the application's texts, see "Texts".
      settings: true,
    }),
  ],
}).mount("#app");
```

The shell needs a `headerActions` place (`backofficeShell()` has one: the sidebar's header on wide screens, the top bar on phones). Nothing else to wire: the inbox has no route of its own and needs no permission, because every route of the module acts on the signed-in person's own notifications.

## The bell and the inbox

- **The bell** shows the number of unread notifications (`99+` past 99); its accessible name says the count ("Notifications, 3 unread").
- **The inbox** opens from the bell as a popover on wide screens and as a bottom sheet on phones. Newest first; unread ones are marked with a dot and a heavier title; each row says when it arrived ("3 minutes ago", through the application's formatting) and is drawn with its category's icon and colour. "Show older" loads the page before the oldest shown (`before_id`).
- **Tapping a row** marks that notification read, on every device, and opens its `link` through the router. A link is a path inside the application (go-core refuses anything else, and a link that is not a path is not followed). A notification with no link only becomes read.
- **"Mark all as read"** marks what the person has seen: everything up to the newest notification the inbox shows (`up_to_id`). One that arrives while they click stays unread.
- Loading, a failure (with "Try again") and an empty inbox are the library's own states. A failed "Show older" says so and keeps what is shown.

## Live

The inbox follows go-core's stream (`GET /v1/notifications/stream`): a new notification appears on the bell and in the open list, and a reading on another device marks the same notification read here. Every event carries the server's unread count, and the count always comes from the server.

- It authenticates with the session cookie. The stream is read with `fetch` through the platform (not `EventSource`, which cannot see a dead connection), so the cookies of the session go with it.
- A dropped connection reconnects after 1 s, 2 s, … up to 30 s, and refetches the count first (through the platform's client, which renews an expired session). A connection silent for two of go-core's 25-second heartbeats is dropped and redone, which is what a phone that switched networks needs.
- Coming back to the foreground, or back online, refetches the count and reconnects at once.
- It lives with the session: sign-out, expiry or a different person (signing in as somebody else included) ends the stream, drops answers still on their way and clears the inbox; the next session starts its own.

go-core's hub is per process: with several server instances an app hears only what its own instance made, which the refetch on reconnect covers.

## Categories

`categories` maps the codes the application registered in go-core (`notification.Category("tickets.assigned")`) to how a row looks: `icon` (any registered icon; default the bell) and `hue` (one of the nine category hues of `Badge`; default neutral). The text of a notification is the server's: it renders it per recipient, in their language, so the library has none of its own for it.

## Notification settings

`/profile/notifications` (route `notifications.settings`, target `notificationSettingsRoutes.index`), for any signed-in person: no permission, only a session. It is reached from the account menu ("Notification settings") and from the gear in the inbox's header (the sheet's footer on phones); `settings: false` leaves the page, the entry and the gear out. The page goes back to "My profile" when `usersFeature` installed it.

- **E-mail me about:** one switch per category go-core lists, saved as it is switched (at once on screen, taken back with a message if the server refuses). A setting somebody else enforces (go-core's `notification.Enforce`) is a row that reads, with a lock and "Set by your organisation": it has no switch. Without e-mail on the server (`email_available: false`) there is one sentence and no switches, and no quiet hours (they only concern e-mail). In-app is not a switch: "In the app: always on".
- **Names of the categories** are the application's texts: `notifications.categories.<code>.label` and an optional `.description`, the code split at its dots (`tickets.assigned` is `notifications.categories.tickets.assigned.label`). A category without a text is shown by its code, never by a missing key.
- **Quiet hours:** on or off, from and to (`TimeField`), and a line in words ("Between 21:00 and 07:00 (Europe/Zagreb) e-mail waits until the quiet hours end"; the zone is the server's). A window may run over midnight; the same time twice is refused on the field. Saved with the button, like the profile's panels (unsaved changes are guarded).

## Failed events

`/events/dead-letters` (route `events.deadletters`), for whoever holds `events.deadletter:view`: the events a consumer of the queue gave up on after its retries, of **every** consumer, not only the notification ones.

- A list with the event, the consumer, the attempts, the last error and when it was given up on; paging; a **Consumer** filter (a choice among the consumer names `GET /v1/events/consumers` lists, behind the same permission; a text field if they cannot be read). No search: the server does not search.
- **Retry** puts one event back in the queue (needs `events.deadletter:retry`). One that was retried meanwhile, or whose event was already removed, is said in words, and an event that was removed has no retry.
- **Retry all for this consumer** asks first, then puts back every failed event of that consumer.
- `deadLetters: { destination }` binds the page to the node of the server's menu that opens it; `deadLetters: false` leaves the page out. The target is `deadLettersRoutes.index`.

<!-- example: docs/examples/notifications/options.ts -->
```ts
// What an application can leave out, link to, or read.
import { deadLettersRoutes, notificationRoutes, notificationSettingsRoutes, notificationsFeature } from "@wssto2/vue-core/notifications";
import type { Notification } from "@wssto2/vue-core/notifications";

// The bell and the inbox only: no dead-letters page and no notification settings.
export const bellOnly = notificationsFeature({ deadLetters: false, settings: false });

// Links are typed targets: `to` of a RouterLink or `router.push`.
export const toTheFailedEvents = deadLettersRoutes.index;
export const toTheSettings = notificationSettingsRoutes.index;

// The route tables go-core's generator wrote, for calls of your own (a button that sends the signed-in person a test notification).
export const sendTest = notificationRoutes.test;

// What a row of the inbox is.
export const title = (notification: Notification) => notification.title;
```

## Texts

`core.notifications.*` (the inbox), `core.notifications.settings.*` and `core.notifications.dead_letters.*` in en, hr, bs, sl and sr-Latn; an application overrides any of them. go-core's reasons are `core.errors.notification.*` (`setting.enforced`, `email.unavailable`, `quiet_hours.invalid`, `category.unknown`), looked up after the application's own `errors.<reason>`. The application adds the names of its categories under `notifications.categories`:

<!-- example: docs/examples/notifications/messages.json -->
```json
{ "notifications": { "categories": { "tickets": { "assigned": { "label": "Ticket assigned to me", "description": "When someone gives you a ticket" } } } } }
```

## Testing

The bell runs in a real application in the library's own tests: a fake server answering by route ([testing](testing.md)), and for the stream a `fetch` that answers with a `ReadableStream` the test writes `data: {...}\n\n` blocks to. Install `notificationsFeature()` and answer `GET /v1/notifications/unread`, `GET /v1/notifications` and the stream.

## Developing against go-core

The dev server seeds two notifications for `user` (one read, one unread) and drains its event queue every second. In `playground/identity.html`, sign in as `user`, open the bell, and press **Send a test notification** on the home page (`POST /v1/notifications/test`): it arrives on the bell within a second. `admin` (the webmaster) can open **Failed events**; the dev server has none until a consumer gives up on an event.

Sign in as `user` and open **Notification settings** (account menu, or the gear in the inbox): the sample category and the quiet hours save against the dev server, which prints the e-mails it would send. Its categories are not enforced, so the locked row is only covered by the library's tests.

Not in these screens yet: devices and push permission.
