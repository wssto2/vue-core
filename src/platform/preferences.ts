import { computed, type ComputedRef } from "vue";
import { ApiError } from "../client";
import type { Platform } from "./platform";
import type { SessionUser } from "./session";

/** A patch of `T` (RFC 7396): any member may be left out; `null` deletes a key; an object merges into the stored one; an array replaces it. */
export type PreferencesPatch<T> = { [K in keyof T]?: T[K] extends readonly unknown[] ? T[K] | null : T[K] extends object ? PreferencesPatch<T[K]> | null : T[K] | null };

/** The signed-in person's stored preferences. See `preferencesOf`. */
export interface Preferences<T extends object> {
  /** What is stored for the person, with the saves still on their way already applied; `{}` when nothing is stored or nobody is signed in. */
  readonly value: Readonly<ComputedRef<Readonly<PreferencesPatch<T>>>>;
  /**
   * Applies `patch` to `value` at once, sends it (`PUT /v1/auth/preferences`), then replaces `value` by the server's merged
   * answer. Saves go one after another, in the order they were made. When the server refuses, only this patch is taken back
   * and the promise rejects with the failure; `usePreferences` reports it instead. Resolves at once, doing nothing, when nobody is signed in.
   */
  save(patch: PreferencesPatch<T>): Promise<void>;
}

type Bag = Record<string, unknown>;

const isBag = (value: unknown): value is Bag => typeof value === "object" && value !== null && !Array.isArray(value);

/** go-core identity's route; its generated entry follows when vue-core syncs the module. */
const PATH = "/v1/auth/preferences";

/**
 * `target` with `patch` merged in as JSON Merge Patch (RFC 7396), which is also what the server does by default: objects
 * merge, `null` deletes a key, everything else (arrays included) replaces. Neither argument is changed.
 */
export function mergePatch(target: unknown, patch: unknown): unknown {
  if (!isBag(patch)) return patch;
  const merged: Bag = isBag(target) ? { ...target } : {};
  for (const [key, value] of Object.entries(patch)) {
    if (key === "__proto__") continue; // JSON.parse can make it an own key; assigning it would change the prototype
    if (value === null) delete merged[key];
    else if (value !== undefined) merged[key] = mergePatch(merged[key], value);
  }
  return merged;
}

const services = new WeakMap<object, Preferences<Bag>>();

/**
 * The preferences of one platform's signed-in person: read from the session, saved through go-core identity's
 * `PUT /v1/auth/preferences`. One service per platform, so every reader sees the same value and every save joins one queue.
 *
 *   const preferences = preferencesOf<{ dark_mode: boolean }>(platform);
 *   await preferences.save({ dark_mode: true });
 *
 * In a component use `usePreferences`, which also reports a refused save.
 */
export function preferencesOf<T extends object = Bag>(platform: Platform<SessionUser>): Preferences<T> {
  let service = services.get(platform);
  if (!service) {
    service = create(platform);
    services.set(platform, service);
  }
  return service as unknown as Preferences<T>;
}

function create({ session, http }: Platform<SessionUser>): Preferences<Bag> {
  const stored = (): Bag => {
    const state = session.state.value;
    return state.status === "authenticated" ? { ...state.preferences } : {};
  };
  const signedIn = (): number | string | null => {
    const state = session.state.value;
    return state.status === "authenticated" ? state.user.id : null;
  };

  // While saves are on their way: what the server last confirmed, and the patches not yet confirmed (the display is the first plus the rest).
  let confirmed: Bag = {};
  let owner: number | string | null = null;
  const pending: { readonly patch: Bag }[] = [];
  let tail: Promise<unknown> = Promise.resolve();

  const show = () => session.update({ preferences: pending.reduce<Bag>((bag, { patch }) => mergePatch(bag, patch) as Bag, confirmed) });
  const leave = (entry: (typeof pending)[number]) => {
    const at = pending.indexOf(entry);
    if (at >= 0) pending.splice(at, 1);
  };

  return {
    value: computed(() => stored()),
    save(patch) {
      const id = signedIn();
      if (id === null) return Promise.resolve();
      if (pending.length === 0 || owner !== id) {
        confirmed = stored();
        owner = id;
        pending.length = 0; // a previous person's saves are theirs to finish
      }
      const entry = { patch: patch as Bag };
      pending.push(entry);
      show();

      const send = async () => {
        try {
          const { data } = await http.put<{ preferences?: unknown }>(PATH, { preferences: patch });
          if (!isBag(data?.preferences)) throw new ApiError({ kind: "malformed", message: "Unreadable preferences answer: expected { preferences: {} }" });
          if (owner === id) confirmed = data.preferences;
          leave(entry);
          if (owner === id && signedIn() === id) show();
        } catch (error) {
          leave(entry);
          if (owner === id && signedIn() === id) show(); // taken back; the other pending patches stay on top
          throw error;
        }
      };
      const sent = tail.then(send);
      tail = sent.catch(() => undefined);
      return sent;
    },
  };
}
