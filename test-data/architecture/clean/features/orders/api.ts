import { ApiError } from "@wssto2/vue-core/client";
import { schema } from "@/generated/schemas/order";

export const listOrders = () => fetch("/api/orders").then(() => [schema, ApiError]);
