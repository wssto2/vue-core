import type { ChangeRow } from "../../modules/identity/entities";

/**
 * A change as the server's change log writes it: go-core's `ChangeRow` (with its `ext`), except that the `action` can be one
 * go-core does not know (a role granted, a binding changed), which the application words with `changeWords`.
 */
export type OpenChangeRow = Omit<ChangeRow, "action"> & { action: ChangeRow["action"] | (string & {}) };
