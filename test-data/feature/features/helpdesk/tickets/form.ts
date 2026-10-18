import { CreateTicketInputSchema, type CreateTicketInput } from "@/generated/routes/tickets/schemas";

// The Go input's rules (required, max) come from the generated schema; extend it here for what only the form knows.
export const TicketFormSchema = CreateTicketInputSchema;

export type TicketForm = CreateTicketInput;
