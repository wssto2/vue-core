import { route } from "../../client";
import type { ChangeRow, UserDetail, UserRow } from "../../modules/identity/entities";
import type { CreateUserInput, UpdateUserInput, UserInput } from "../../modules/identity/schemas";
import { MANAGE_USERS } from "./access";

/**
 * What an application's own `UserExtension` on the server adds to go-core's users: an `ext` on every row, detail, change and
 * on the create / update bodies, and `details` on the deactivation. go-core passes it through untouched, so the library types
 * it `unknown` and the application narrows it to the shape its server writes (a dealer, roles, a hand-over plan).
 */
export type WithExt<T> = T & { ext?: unknown };

export type UserRowWithExt = WithExt<UserRow>;
export type UserDetailWithExt = WithExt<UserDetail>;
/** A change as the server's change log writes it: its `action` can be one go-core does not know (a role granted), and it carries an `ext`. */
export type ChangeRowWithExt = WithExt<Omit<ChangeRow, "action"> & { action: ChangeRow["action"] | (string & {}) }>;
/** The body of "create": go-core's fields and the extension's. */
export type CreateUserWithExt = WithExt<CreateUserInput>;
/** The body of "update": go-core's fields and the extension's. */
export type UpdateUserWithExt = WithExt<UpdateUserInput>;
/** The body of "deactivate": the person, and what the application's deactivation hook needs (hand-over recipients, say). */
export type DeactivateUserInput = UserInput & { details?: unknown };

/**
 * The routes that carry an `ext`, for a replaced dialog or section to call: the same paths and permissions as
 * `identityRoutes.usersCreate`, `usersUpdate` and `usersDeactivate`, typed with the extension. The answer's `ext` is what
 * the server's extension returned for the person (for a new one, its result, such as the bindings it skipped).
 */
export const usersExtRoutes = {
  create: route<CreateUserWithExt, UserDetailWithExt>("POST", "/v1/iam/users", { permission: MANAGE_USERS }),
  update: route<UpdateUserWithExt, UserDetailWithExt>("PUT", "/v1/iam/users/:id", { permission: MANAGE_USERS }),
  deactivate: route<DeactivateUserInput, { ext?: unknown }>("POST", "/v1/iam/users/:id/deactivate", { permission: MANAGE_USERS }),
};
