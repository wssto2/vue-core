// Offender (deep-import): outside code reaches into a feature past index.ts / routes.ts.
import { row } from "@/features/orders/components/OrderRow";
// Allowed by allow["deep-import"].
import { loadRows } from "@/features/orders/helpers";
import { routes } from "@/features/orders/routes";
// Offender (generated, moved): the old entities folder.
import { Order } from "@/entities/order";
// Fine: an allowed generated subpath.
import { schema } from "@/generated/schemas/order";

export { row, loadRows, routes, Order, schema };
