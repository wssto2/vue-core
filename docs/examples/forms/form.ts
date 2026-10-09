import { useForm, type FormValidator } from "@wssto2/vue-core/form";
import type { Ticket, TicketBody } from "./api";

/** What the fields edit: the draft. A nullable column is `""` here, a missing priority `null`: the mapping below says so once. */
export interface TicketValues {
  subject: string;
  priority: number | null;
  dueOn: string | null;
  email: string;
  phone: string;
}

export const emptyTicket = (): TicketValues => ({ subject: "", priority: null, dueOn: null, email: "", phone: "" });

/** DTO to draft. */
export const ticketValues = (ticket: Ticket): TicketValues => ({ subject: ticket.subject, priority: ticket.priority, dueOn: ticket.due_on, email: ticket.email, phone: ticket.phone });

/** Draft to the record's full-update body: the endpoint's names, and the version the record was read at. */
export const ticketBody = (values: TicketValues, ticket: Ticket): TicketBody => ({
  subject: values.subject.trim(),
  priority: values.priority,
  due_on: values.dueOn,
  email: values.email.trim(),
  phone: values.phone,
  version: ticket.version,
});

/** The app's schema: anything with Zod's `safeParse` shape fits (Zod itself, in a real app). */
export const ticketSchema: FormValidator<TicketValues> = {
  safeParse(input) {
    const values = input as TicketValues;
    const issues: { path: string[]; message: string }[] = [];
    if (values.subject.trim() === "") issues.push({ path: ["subject"], message: "Enter a subject." });
    if (values.email !== "" && !values.email.includes("@")) issues.push({ path: ["email"], message: "Enter a valid e-mail address." });
    return issues.length > 0 ? { success: false, error: { issues } } : { success: true, data: values };
  },
};

/** `due_on` to `dueOn`: the server names fields in snake_case, the draft in camelCase. */
export const camel = (field: string): string => field.replace(/_([a-z])/g, (_match, letter: string) => letter.toUpperCase());

/** A form for a ticket that does not exist yet. */
export function useCreateTicketForm(t: (key: string) => string) {
  return useForm({
    defaults: () => ({ subject: "", priority: null as number | null, tags: [] as string[] }), // the draft: what fields edit
    validator: {
      safeParse: (input) => ((input as { subject: string }).subject.trim() === "" ? { success: false, error: { issues: [{ path: ["subject"], message: "Enter a subject." }] } } : { success: true, data: input as { subject: string; priority: number | null; tags: string[] } }),
    },
    describeFieldError: (message) => t(message), // server codes into sentences
    serverField: camel, // `due_on` is `dueOn` in the draft
  });
}

export type CreateTicketForm = ReturnType<typeof useCreateTicketForm>;
