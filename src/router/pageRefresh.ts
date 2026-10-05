import { type InjectionKey, type Ref } from "vue";

/**
 * Bumped by the shell's pull to refresh; the page outlet of the shell (an `AppRouterView` at depth 0) is keyed by it, so
 * the page remounts and reloads its data while everything around it stays. Internal: not exported from `router`.
 */
export const pageRefreshKey: InjectionKey<Ref<number>> = Symbol("vue-core.pageRefresh");
