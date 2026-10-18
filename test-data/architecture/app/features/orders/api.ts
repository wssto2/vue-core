// Offender (generated): a generated subpath the config does not allow.
import { raw } from "@/generated/internal/raw";

export const listOrders = () => fetch("/api/orders").then((response) => response.json()).then((rows) => [...rows, raw]);
