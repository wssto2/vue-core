import { useI18n } from "vue-i18n";
import type { AccessQualifier } from "../platform";
import { SYSTEM_GROUP } from "./catalogue";
import { useAccessContext } from "./context";

/** A role as the screens name it: predefined roles by their key, custom ones by the name they were saved with. */
export interface RoleName {
  readonly key?: string | null;
  readonly name: string;
}

/** A place as the server names it. */
export interface ScopeName {
  readonly level: string;
  readonly name?: string | null;
}

/**
 * The words of access. The library's own texts are `core.access.*`; the application's catalogue
 * brings its own: a permission's label and description by the keys the catalogue holds, modules under
 * `access.modules.<module>`, screens under `access.resources.<module_resource>`, record types under
 * `access.ownable.<type>`, predefined roles under `access.roles.<key>`, hierarchy levels under
 * `access.levels.<level>`. A name nobody wrote a text for is shown as it is.
 */
export function useAccessLabels() {
  const { t, te } = useI18n();
  const { catalogue } = useAccessContext();
  const first = (keys: readonly string[], fallback: string): string => {
    const found = keys.find((key) => te(key));
    return found ? t(found) : fallback;
  };

  const levelLabel = (level: string) => first([`access.levels.${level}`, `core.access.levels.${level}`], level);
  return {
    roleName: (role: RoleName) => (role.key ? first([`access.roles.${role.key}`], role.name) : role.name),
    permissionLabel: (id: string) => first(catalogue[id]?.labelKey ? [catalogue[id].labelKey] : [], id),
    permissionDescription: (id: string) => first(catalogue[id]?.descriptionKey ? [catalogue[id].descriptionKey] : [], ""),
    groupLabel: (group: string) => first([`access.modules.${group}`, ...(group === SYSTEM_GROUP ? ["core.access.system_group"] : [])], group),
    screenLabel: (key: string) => first([`access.resources.${key}`], key),
    ownableLabel: (ownable: string) => first([`access.ownable.${ownable.replace(/\./g, "_")}`], ownable),
    qualifierLabel: (qualifier: AccessQualifier) => t(`core.access.qualifier.${qualifier}`),
    qualifierHint: (qualifier: AccessQualifier) => t(`core.access.qualifier_hint.${qualifier}`),
    qualifierNoun: (qualifier: AccessQualifier) => t(`core.access.qualifier_noun.${qualifier}`),
    levelLabel,
    /** A place: the level and its name (`Dealer · Auto Zagreb`); the root, which has no name, by its level. */
    scopeLabel: (scope: ScopeName) => (scope.name ? `${levelLabel(scope.level)} · ${scope.name}` : levelLabel(scope.level)),
    roleKind: (role: { predefined: boolean; computed: boolean }) => t(`core.access.role_kind.${role.computed ? "computed" : role.predefined ? "predefined" : "custom"}`),
  };
}
