// The CRUD feature's view of go-core/tickets: the same route table with the names and fields the default feature template
// (bin/templates/feature-crud) is written for, which a real feature's Go contract gives it (`list`, `show`, `create`; an entity with `name` and timestamps).
import type { Ticket } from "../../../../go-core/tickets/entities";

export type TicketResponse = Ticket & { name: string; created_at: string; updated_at: string };
