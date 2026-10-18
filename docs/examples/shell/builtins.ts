import { darkMode, offlineNotice, quickSearch } from "@wssto2/vue-core/shell";
import { ref } from "vue";
import { ticketRoutes } from "../tickets/routes";
import type { Ticket } from "../tickets/api";

// `darkMode()` alone keeps the choice in the person's stored preferences; `dark` and `set` keep it where you like: here a ref.
const dark = ref(false);

/** The shell's opt-in features: put them in `createApplication({ features })` beside your own. */
export function shellBuiltins(searchTickets: (query: string, signal: AbortSignal) => Promise<readonly Ticket[]>) {
  return [
    darkMode({ dark: () => dark.value, set: (value) => void (dark.value = value) }),
    offlineNotice(),
    quickSearch({
      // The application asks its server and maps the answer to rows; the palette debounces, drops stale answers and highlights.
      search: async (query, signal) => ({
        groups: [{
          key: "tickets",
          label: "Tickets",
          rows: (await searchTickets(query, signal)).map((ticket) => ({
            key: `ticket-${ticket.id}`,
            title: ticket.subject,
            meta: `#${ticket.id}`,
            icon: "fileTextLine",
            to: ticketRoutes.record({ ticketID: ticket.id }),
          })),
        }],
      }),
      placeholder: "Search tickets…",
    }),
  ];
}
