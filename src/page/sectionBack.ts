import type { Ref } from "vue";
import { defineFeatureContext } from "../platform/context";
import type { PageSectionBack } from "./types";

/**
 * Provided by `AdaptivePageShell`: where a section navigator inside a record page says "back"
 * leads when it is not the list (see `PageSectionBack`). Set it to null to restore the page's own.
 */
export const [pageSectionBackKey, usePageSectionBack] = defineFeatureContext<Ref<PageSectionBack | null>>("vue-core.pageSectionBack");
