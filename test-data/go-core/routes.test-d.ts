// Type fixtures, checked by `npm run typecheck`: go-core's generated route tables compile against the
// library unchanged, and misusing `request` is a compile error, not a runtime surprise.
import { createHttpClient } from "@wssto2/vue-core/client";
import type { Ticket } from "./tickets/entities";
import { ticketsRoutes } from "./tickets/routes";
import { identityRoutes } from "./identity/routes";
import { accessRoutes } from "./access/routes";

const http = createHttpClient();

export async function fixtures() {
  // the generated shapes: input and response are typed from the route
  const shown = await http.request(ticketsRoutes.show, { id: 7 });
  const ticket: Ticket = shown.data;
  const title: string = ticket.title;
  await http.request(ticketsRoutes.create, { title: "t", owner: { id: 1, name: "n" } });
  await http.request(accessRoutes.subjectsUnbind, { id: 1, binding_id: 2 });

  // routes without input need no second argument; a route without a body resolves to data null
  const health = await http.request(ticketsRoutes.getHealth);
  const text: string = health.data;
  const out = await http.request(identityRoutes.logout);
  const nothing: null = out.data;
  await http.request(identityRoutes.me, undefined, { signal: new AbortController().signal });

  // @ts-expect-error the input is the route's: a missing field
  await http.request(ticketsRoutes.create, { title: "t" });
  // @ts-expect-error the input is the route's: a wrong field type
  await http.request(ticketsRoutes.show, { id: "7" });
  // @ts-expect-error the input is the route's: an unknown field
  await http.request(ticketsRoutes.show, { id: 7, extra: true });
  // @ts-expect-error a route with input needs it
  await http.request(ticketsRoutes.show);
  // @ts-expect-error the response is typed: a ticket has no such field
  const missing = shown.data.nope;
  // @ts-expect-error the response is typed: a number is not a string
  const wrong: number = shown.data.title;
  // @ts-expect-error a void route has no data to use
  const data: string = out.data;
  // @ts-expect-error a raw route is a stream or a file, not a JSON call
  await http.request(ticketsRoutes.getEvents);
  // @ts-expect-error a raw route is a stream or a file, not a JSON call
  await http.request(accessRoutes.me);

  return { title, text, nothing, missing, wrong, data, path: ticketsRoutes.getEvents.path };
}
