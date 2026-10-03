import { shallowReactive } from "vue";
import { identityRoutes } from "../../modules/identity/routes";
import { usePlatform } from "../../platform";
import { VIEW_USERS } from "../users/access";

/**
 * The names of the people who did things to an account (a row says `actor_id`, never a name). Asked one person at a time,
 * once each, and only by someone who may see people; whoever may not, or when the person is gone, reads as no name, and
 * the rows then say "somebody else" instead of a number.
 *
 *   const actors = useActorNames();
 *   watch(rows, (list) => actors.load(list.map((row) => row.actor_id)));
 *   actors.nameOf(row.actor_id)
 */
export function useActorNames() {
  const { http, access } = usePlatform();
  const names = shallowReactive(new Map<number, string | null>());
  const asked = new Set<number>();

  function load(ids: Iterable<number | null>): void {
    if (!access.can(VIEW_USERS)) return;
    for (const id of ids) {
      if (id === null || asked.has(id)) continue;
      asked.add(id);
      http.request(identityRoutes.usersShow, { id }).then(
        (result) => names.set(id, result.data.name),
        () => names.set(id, null),
      );
    }
  }

  return { load, nameOf: (id: number | null): string | null => (id === null ? null : (names.get(id) ?? null)) };
}
