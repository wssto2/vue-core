<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import Banner from "../state/Banner.vue";
import { fieldOfPath } from "./validation";
import type { Form } from "./useForm";

/**
 * What a form tells in words when the fields cannot: why a submit failed (conflict, no permission, expired
 * session, offline, a refresh that failed after a save that worked) and the errors that have no field on screen,
 * whether the form does not have that field (a server field the draft lacks) or it is in a part that is not
 * shown (a hidden or collapsed section). Put it above the fields; `FormView`, `EditorPage` and `GroupSheet` already do.
 *
 *   <FormErrors :form="form" :label="fieldLabel" />
 *
 * A field counts as shown while an element carries `data-field-key="<name>"` (`form.bind()` sets it).
 */
const props = withDefaults(defineProps<{
  form: Pick<Form<object>, "failure" | "errors" | "unplaced">;
  /** The name of a field for people (`(key) => t("ticket." + key)`); by default the key. */
  label?: (field: string) => string;
  /** Where to look for shown fields; by default the whole document. */
  scope?: ParentNode | null;
}>(), { label: (field: string) => field, scope: null });

const { t } = useI18n();
const hidden = ref<readonly { field: string; message: string }[]>([]);

watch(
  () => props.form.errors.all(),
  async (errors) => {
    await nextTick();
    const root = props.scope ?? document;
    hidden.value = Object.entries(errors).flatMap(([path, messages]) => {
      const field = fieldOfPath(path);
      const message = messages[0];
      return message && !root.querySelector(`[data-field-key~="${CSS.escape(field)}"]`) ? [{ field: path, message }] : [];
    });
  },
  { immediate: true },
);

// The form's own unplaced errors first; the rest of the hidden ones after them, once each.
const listed = computed(() => {
  const own = props.form.unplaced.value;
  return [...own, ...hidden.value.filter((entry) => !own.some((known) => known.field === entry.field))];
});
const failure = computed(() => props.form.failure.value);
const tone = computed(() => (failure.value?.kind === "conflict" || failure.value?.kind === "refresh" ? "warning" : "critical"));
</script>

<template>
  <Banner v-if="failure || listed.length" :tone="failure ? tone : 'warning'" data-test="form-errors">
    <p v-if="failure" class="text-footnote font-medium">{{ failure.message }}</p>
    <template v-if="listed.length">
      <p class="text-footnote" :class="failure ? 'mt-1' : 'font-medium'">{{ t("core.form.errors.hidden_title") }}</p>
      <ul class="mt-1 list-inside list-disc text-footnote" data-test="form-errors-hidden">
        <li v-for="entry in listed" :key="entry.field">{{ entry.field ? props.label(entry.field) : "" }}<template v-if="entry.field">: </template>{{ entry.message }}</li>
      </ul>
    </template>
    <p v-if="failure?.requestId" class="mt-1 text-caption text-content-muted">{{ t("core.form.errors.request", { id: failure.requestId }) }}</p>
  </Banner>
</template>
