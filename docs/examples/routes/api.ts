import { createHttpClient, isApiError } from "@wssto2/vue-core/client";
import { ticketsRoutes } from "./routes";
import { route } from "@wssto2/vue-core/client";

const http = createHttpClient({ baseUrl: "/api" });

// A path parameter and the rest as the query: GET /api/v1/tickets/7
export async function loadTicket(id: number, signal: AbortSignal) {
  const result = await http.request(ticketsRoutes.show, { id }, { signal });
  return result.data; // typed as Ticket
}

const create = route<{ subject: string }, { id: number }>("POST", "/v1/tickets");
const close = route<{ id: number; reason: string }, void>("POST", "/v1/tickets/:id/close");
const health = route<void, string>("GET", "/v1/health");

export async function work() {
  // POST: the input is the JSON body
  const created = await http.request(create, { subject: "Printer" });
  // path parameter out of the input, the rest in the body; a route without a body resolves to data null
  await http.request(close, { id: created.data.id, reason: "done" });
  // no input: no second argument
  return (await http.request(health)).data;
}

export async function safely() {
  try {
    await http.request(ticketsRoutes.show, { id: 0 });
  } catch (error) {
    // the server's answers are ApiErrors; a missing path parameter is a plain Error (a bug, thrown before sending)
    if (isApiError(error)) return error.kind;
    throw error;
  }
}
