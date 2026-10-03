<script setup lang="ts">
import { computed, nextTick, useTemplateRef, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useCompactPresentation } from "../internal/mediaQuery";
import AdaptivePageShell from "../page/AdaptivePageShell.vue";
import SectionJumper from "../page/SectionJumper.vue";
import SectionList from "../page/SectionList.vue";
import { provideSectionIndex } from "../page/sectionIndex";
import type { PageBack } from "../page/types";
import EditorChrome from "./EditorChrome.vue";
import { focusFirstError } from "./focus";
import FormErrors from "./FormErrors.vue";
import { useSectionStates } from "./sectionStates";
import type { Form } from "./useForm";

/**
 * The page around a long form (create a record, or a justified long edit): the toolbar with Back and the form's primary action,
 * the numbered sections with their state and the required-field progress beside the form on wide screens, and the floating
 * section jumper on compact ones. The form's sections are `SectionPanel`s in the default slot; `#aside` pins whatever the editor
 * needs under the section list (a running total).
 *
 *   <EditorPage :title="t('offers.create')" :back="backToOffers" :form="editor.form" :save-label="t('offers.create')" @save="editor.submit">
 *     <OfferForm :editor="editor" />
 *     <template #aside><OfferSummary :values="editor.form.values" /></template>
 *   </EditorPage>
 *
 * With a `form` it does the rest: Save in the page chrome (a spinner while it works), "Unsaved changes", Cancel, the leave guard, the
 * failure banner (and the errors whose field is in a collapsed or hidden section), a count of errors and a check per section, and
 * focus on the first error after a refused submit (its section opened first). A save does not start a second time while one runs.
 * This is one page-level save: a page of group sheets (D22) has none.
 */
const props = withDefaults(defineProps<{
  title: string;
  back: PageBack;
  form?: Pick<Form<object>, "dirty" | "submitting" | "failure" | "errors" | "reset">;
  /** The name of the primary action ("Create offer"); by default "Save". */
  saveLabel?: string;
  /** Whether the viewer may save; default true. */
  canSave?: boolean;
  /** The name of a field for people, for errors whose field is not on screen. */
  fieldLabel?: (field: string) => string;
}>(), { form: undefined, saveLabel: undefined, canSave: true, fieldLabel: undefined });

const emit = defineEmits<{ save: []; cancel: [] }>();

defineSlots<{
  default?: () => unknown;
  /** Replaces the large title, e.g. a `RecordHeader` when the editor is a record. */
  header?: () => unknown;
  /** Under the section list on wide screens: the editor's own pinned state. */
  aside?: () => unknown;
  /** The record pager. */
  pager?: () => unknown;
  notices?: () => unknown;
  /** A bar in the bottom dock, under the section jumper on compact screens. */
  bottom?: () => unknown;
}>();

const { t } = useI18n();
const compact = useCompactPresentation();
const index = provideSectionIndex();
const { states, totals } = useSectionStates(index);
const content = useTemplateRef<HTMLElement>("content");

const chrome = computed(() =>
  props.form
    ? {
        form: props.form,
        label: () => props.saveLabel ?? t("core.actions.save"),
        allowed: () => props.canSave,
        save: () => {
          if (!props.form?.submitting.value) emit("save");
        },
        cancel: () => {
          props.form?.reset();
          emit("cancel");
        },
      }
    : null,
);

// After a refused submit the first error is shown: its section opened, its field focused.
watch(
  () => props.form?.failure.value,
  async (failure) => {
    if (failure?.kind !== "invalid") return;
    await nextTick();
    await focusFirstError(content.value ?? document, index);
  },
);

function focusSection(id: string) {
  const element = index.sections.value.find((section) => section.id === id)?.element;
  if (element) void nextTick(() => focusFirstError(element));
}
</script>

<template>
  <AdaptivePageShell :title="props.title" :back="props.back" width="content">
    <template v-if="$slots.header" #header><slot name="header" /></template>
    <template v-if="$slots.pager" #pager><slot name="pager" /></template>
    <template v-if="$slots.notices" #notices><slot name="notices" /></template>
    <template v-if="$slots.bottom" #bottom><slot name="bottom" /></template>

    <EditorChrome v-if="chrome" :options="chrome" />

    <div class="grid min-w-0 grid-cols-1 items-start gap-8 lg:grid-cols-[12.5rem_minmax(0,1fr)]" data-test="editor-page">
      <aside v-if="!compact" class="sticky top-[calc(var(--app-bar-height)+1.5rem+var(--shell-banner-h,0px))] hidden min-w-0 flex-col gap-4 self-start lg:flex">
        <SectionList standalone :states="states" :progress="totals" @select="focusSection" />
        <slot name="aside" />
      </aside>
      <div ref="content" class="flex min-w-0 flex-col gap-section-gap">
        <FormErrors v-if="props.form" :form="props.form" :label="props.fieldLabel" :scope="content" />
        <slot />
      </div>
    </div>

    <SectionJumper v-if="compact" :states="states" />
  </AdaptivePageShell>
</template>
