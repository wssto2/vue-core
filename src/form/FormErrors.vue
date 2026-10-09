<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import Banner from "../state/Banner.vue";
import type { Form } from "./useForm";
import { useHiddenFieldErrors } from "./useHiddenFieldErrors";

/**
 * What a form tells in words when the fields cannot: why a submit failed (conflict, no permission, expired
 * session, offline, a refresh that failed after a save that worked) and the errors that have no field on screen,
 * whether the form does not have that field (a server field the draft lacks) or it is in a part that is not
 * shown (a hidden or collapsed section). Put it above the fields; `FormView`, `EditorPage` and `GroupSheet` already do.
 *
 *   <FormErrors :form="form" :label="fieldLabel" />
 *
 * A field counts as shown while an element carries `data-field-key="<name>"` (`form.bind()` sets it; `fieldKey(path)` does for a field wired by hand,
 * such as one inside a list), or carries the name of something that contains it. `useHiddenFieldErrors` is the same list for your own use.
 */
const props = withDefaults(defineProps<{
  form: Pick<Form<object>, "failure" | "errors">;
  /** The name of a field for people (`(key) => t("ticket." + key)`); by default the key. */
  label?: (field: string) => string;
  /** Where to look for shown fields; by default the whole document. */
  scope?: ParentNode | null;
}>(), { label: (field: string) => field, scope: null });

const { t } = useI18n();
const hidden = useHiddenFieldErrors({
  get form() { return props.form; },
  root: () => props.scope,
});

const failure = computed(() => props.form.failure.value);
const tone = computed(() => (failure.value?.kind === "conflict" || failure.value?.kind === "refresh" ? "warning" : "critical"));
</script>

<template>
  <Banner v-if="failure || hidden.length" :tone="failure ? tone : 'warning'" data-test="form-errors">
    <p v-if="failure" class="text-footnote font-medium">{{ failure.message }}</p>
    <template v-if="hidden.length">
      <p class="text-footnote" :class="failure ? 'mt-1' : 'font-medium'">{{ t("core.form.errors.hidden_title") }}</p>
      <ul class="mt-1 list-inside list-disc text-footnote" data-test="form-errors-hidden">
        <li v-for="entry in hidden" :key="entry.field">{{ entry.field ? props.label(entry.field) : "" }}<template v-if="entry.field">: </template>{{ entry.message }}</li>
      </ul>
    </template>
    <p v-if="failure?.requestId" class="mt-1 text-caption text-content-muted">{{ t("core.form.errors.request", { id: failure.requestId }) }}</p>
  </Banner>
</template>
