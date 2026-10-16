import { createPicker, type PickerOptions } from "@wssto2/vue-core/collection";
import type { Ticket } from "./api";

/** "Choose a ticket", for any screen to ask: `const ticket = await ticketPicker.pick({ title: "Merge into…" })` is a Ticket, or null when dismissed. */
export const ticketPicker = createPicker<Ticket, PickerOptions>();
