import { z } from "zod";

export const CreateTicketInputSchema = z.object({ name: z.string().min(1).max(100) });

export type CreateTicketInput = z.infer<typeof CreateTicketInputSchema>;
