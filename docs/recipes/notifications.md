# Recipe: notifications

go-core's notification module is the in-app inbox: what a person finds when they open the application, read on one device and read on all of them. `notificationsFeature()` is its screens, in `@wssto2/vue-core/notifications`, next to [`identityFeature()`](sign-in.md): the bell with the unread count, the inbox it opens, the live stream behind both, and a page of the events that failed.

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
    }),
  ],
}).mount("#app");
```

The shell needs a `headerActions` place (`backofficeShell()` has one: the sidebar's header on wide screens, the top bar on phones). Nothing else to wire: the feature has no route of its own for the inbox and needs no permission, because every route of the module acts on the signed-in person's own notifications.

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

## Failed events

`/events/dead-letters` (route `events.deadletters`), for whoever holds `events.deadletter:view`: the events a consumer of the queue gave up on after its retries, of **every** consumer, not only the notification ones.

- A list with the event, the consumer, the attempts, the last error and when it was given up on; paging; a **Consumer** filter (the exact name go-core filters by). No search: the server does not search.
- **Retry** puts one event back in the queue (needs `events.deadletter:retry`). One that was retried meanwhile, or whose event was already removed, is said in words, and an event that was removed has no retry.
- **Retry all for this consumer** asks first, then puts back every failed event of that consumer.
- `deadLetters: { destination }` binds the page to the node of the server's menu that opens it; `deadLetters: false` leaves the page out. The target is `deadLettersRoutes.index`.

<!-- example: docs/examples/notifications/options.ts -->
```ts
// What an application can leave out, link to, or read.
import { deadLettersRoutes, notificationRoutes, notificationsFeature } from "@wssto2/vue-core/notifications";
import type { Notification } from "@wssto2/vue-core/notifications";

// The bell and the inbox only: no dead-letters page.
export const bellOnly = notificationsFeature({ deadLetters: false });

// Links are typed targets: `to` of a RouterLink or `router.push`.
export const toTheFailedEvents = deadLettersRoutes.index;

// The route tables go-core's generator wrote, for calls of your own (a button that sends the signed-in person a test notification).
export const sendTest = notificationRoutes.test;

// What a row of the inbox is.
export const title = (notification: Notification) => notification.title;
```

## Texts

`core.notifications.*` (the inbox) and `core.notifications.dead_letters.*` (the page) in en, hr, bs and sl; an application overrides any of them. The module has no error codes of its own: a refused request is said by the generic `core.errors.*` sentences.

## Testing

The bell runs in a real application in the library's own tests: a fake server answering by route ([testing](testing.md)), and for the stream a `fetch` that answers with a `ReadableStream` the test writes `data: {...}\n\n` blocks to. Install `notificationsFeature()` and answer `GET /v1/notifications/unread`, `GET /v1/notifications` and the stream.

## Developing against go-core

The dev server seeds two notifications for `user` (one read, one unread) and drains its event queue every second. In `playground/identity.html`, sign in as `user`, open the bell, and press **Send a test notification** on the home page (`POST /v1/notifications/test`): it arrives on the bell within a second. `admin` (the webmaster) can open **Failed events**; the dev server has none until a consumer gives up on an event.

Not in these screens yet: notification preferences, quiet hours, devices, push permission and e-mail (they come with go-core's delivery channels).
