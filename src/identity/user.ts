import type { UserParser } from "../platform";
import type { User } from "../modules/identity/entities";

/** The signed-in person as go-core's identity module projects them by default. */
export type IdentityUser = User;

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

/** Reads go-core's default user projection (`{ id, login, name, email, locale }`); throws naming the first wrong field. */
export const parseIdentityUser: UserParser<IdentityUser> = (raw) => {
  if (!isObject(raw)) throw new TypeError("expected an object");
  if (typeof raw.id !== "number") throw new TypeError("id: expected a number");
  for (const key of ["login", "name", "email", "locale"] as const) {
    if (typeof raw[key] !== "string") throw new TypeError(`${key}: expected a string`);
  }
  return { id: raw.id, login: raw.login as string, name: raw.name as string, email: raw.email as string, locale: raw.locale as string };
};
