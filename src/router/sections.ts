import { computed, watch, type ComputedRef } from "vue";
import { useI18n } from "vue-i18n";
import { useRoute, useRouter, type RouteLocationRaw, type RouteRecordNormalized, type RouteRecordRaw } from "vue-router";
import type { IconName } from "../icon";
import { usePlatform } from "../platform/platform";
import { isAllowed } from "./meta";

/** One section of a record page, as its navigation shows it. */
export interface SectionLink {
  /** The section route's name. */
  readonly name: string;
  readonly label: string;
  /** The one-word label for compact controls; the label when the route gave none. */
  readonly shortLabel: string;
  readonly icon: IconName;
  /** The translated group heading, when the route declares one. */
  readonly group?: string;
  readonly to: RouteLocationRaw;
  readonly active: boolean;
}

export interface RouteSections {
  /** The sections the session may open, in the order of the routes. */
  readonly sections: ComputedRef<readonly SectionLink[]>;
  /** How many sections the record's routes declare, whatever the session may open: no section open out of several is a different state from a record without sections. */
  readonly declared: ComputedRef<number>;
  readonly active: ComputedRef<SectionLink | null>;
  /** The first section the session may open: where the bare record URL and "back" lead. */
  readonly first: ComputedRef<SectionLink | null>;
  /** The route is a page inside the active section (`meta.sectionParent`), not the section itself. */
  readonly subPage: ComputedRef<boolean>;
  /** The route is the record itself, with no section chosen (its bare URL). */
  readonly bare: ComputedRef<boolean>;
  /** The route is a section (or a page inside one) that the session may not open. */
  readonly denied: ComputedRef<boolean>;
}

/**
 * The sections of the record page the current route belongs to: its child routes that have
 * `meta.section`. The label, icon and access live on the route once, so every width of the
 * navigation agrees and a page keeps no array of its own.
 *
 *   children: [
 *     { name: "dealers.general", path: "general", component: General, meta: { section: { labelKey: "dealers.general", icon: "buildingLine" } } },
 *     { name: "dealers.locations", path: "locations", component: Locations, meta: { access: "locations:view", section: { labelKey: "dealers.locations", icon: "mapPin" } } },
 *   ]
 *
 * A section the session may not open (`meta.access`) is left out. A page inside a section is a
 * sibling route without `meta.section` and with `meta.sectionParent` naming the section's route.
 * Links keep the query (a list's state) and carry only the params their own path declares.
 */
export function useRouteSections(): RouteSections {
  const route = useRoute();
  const router = useRouter();
  const { access } = usePlatform();
  const { t } = useI18n();

  // The nearest matched record whose children declare sections: the record page.
  const owner = computed<RouteRecordNormalized | null>(() => {
    for (let index = route.matched.length - 1; index >= 0; index--) {
      const record = route.matched[index];
      if (record?.children.some((child) => child.name && child.meta?.section)) return record;
    }
    return null;
  });
  const children = computed(() => (owner.value?.children ?? []).filter((child) => child.name && child.meta?.section));
  const isCurrent = (child: RouteRecordRaw) => route.matched.some((record) => record.name === child.name) || route.meta.sectionParent === child.name;

  // A link carries only the params its own path declares: a sub-page's extra param would be discarded with a router warning.
  const paramsFor = (name: RouteRecordRaw["name"]) => {
    const path = router.getRoutes().find((record) => record.name === name)?.path ?? "";
    const keys = new Set([...path.matchAll(/:(\w+)/g)].map((match) => match[1]));
    return Object.fromEntries(Object.entries(route.params).filter(([key]) => keys.has(key)));
  };

  const sections = computed<readonly SectionLink[]>(() =>
    children.value
      .filter((child) => isAllowed(child.meta?.access, access))
      .map((child) => {
        const meta = child.meta!.section!;
        const label = t(meta.labelKey);
        return {
          name: String(child.name),
          label,
          shortLabel: meta.shortLabelKey ? t(meta.shortLabelKey) : label,
          icon: meta.icon,
          group: meta.groupKey ? t(meta.groupKey) : undefined,
          to: { name: child.name!, params: paramsFor(child.name), query: route.meta.sectionParent ? {} : route.query },
          active: isCurrent(child),
        };
      }),
  );
  const active = computed(() => sections.value.find((section) => section.active) ?? null);

  return {
    sections,
    declared: computed(() => children.value.length),
    active,
    first: computed(() => sections.value[0] ?? null),
    subPage: computed(() => !!active.value && route.meta.sectionParent === active.value.name),
    bare: computed(() => !!owner.value && route.matched[route.matched.length - 1] === owner.value),
    denied: computed(() => children.value.some(isCurrent) && !active.value),
  };
}

/**
 * Keeps a record page on a section it may open: the bare record URL, and a section the session may
 * no longer open (a direct link, a permission that was taken away), move to the first section it can
 * (replace, no history entry). When it can open none nothing moves: the page shows its no-access
 * state, and there is no redirect to loop on.
 */
export function useFirstSectionRedirect(state: RouteSections): void {
  const router = useRouter();
  watch(
    () => [state.bare.value || state.denied.value, state.first.value] as const,
    ([misplaced, first]) => {
      if (misplaced && first) void router.replace(first.to);
    },
    { immediate: true },
  );
}
