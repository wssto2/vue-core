<script setup lang="ts">
import { computed, inject, provide, ref, shallowReactive, useId, useTemplateRef, type Ref } from "vue";
import { sectionId, useSectionAnchor } from "../page";
import { formEditableKey, formGroupKey } from "./field";
import GroupEditAction from "./GroupEditAction.vue";
import { useRecordGroups } from "./recordGroups";

/**
 * An inset grouped list of rows, iOS and macOS Settings style. Every field inside renders as a row: a
 * label column with a borderless control when editable, a muted label and a trailing value when the
 * form reads. Empty read-only rows are hidden, and a group whose rows are all hidden disappears.
 * Headers sit above the cell, explanations below it: never banners between fields.
 *
 *   <FormGroup :header="t('contact')" :footer="t('contactHint')">
 *     <TextField v-bind="form.bind('email')" :label="t('email')" required />
 *     <SwitchField v-bind="form.bind('newsletter')" :label="t('newsletter')" />
 *   </FormGroup>
 *
 * Read mode is the form's (`FormView :editable`) or this group's (`:editable="false"`: one group that reads
 * while the rest of the form edits). A value that cannot change while the form edits is locked with the
 * field's `disabled`; `lockedFooter` says why once, under the group, only while one of its fields is locked.
 */
const props = withDefaults(defineProps<{
  header?: string;
  footer?: string;
  /** Hide read-only rows without a value (the default). */
  hideEmpty?: boolean;
  /** The label column on wide screens. */
  labelWidth?: string;
  /** Lists the group in the page's section list, titled by its header: for a long page of groups. */
  section?: boolean;
  /** The anchor and URL fragment of a section group; by default a slug of the header. */
  anchor?: string;
  editable?: boolean;
  /** Why some rows cannot change, shown under the group while one of its fields is locked. */
  lockedFooter?: string;
  /**
   * The group's key in a record edited where it reads (`provideRecordGroups`, `useGroupSheet`): on the read page it shows Edit,
   * in its sheet (`RecordGroupScope`) only this group renders.
   */
  group?: string;
}>(), {
  header: undefined,
  footer: undefined,
  hideEmpty: true,
  labelWidth: "11rem",
  section: false,
  anchor: undefined,
  editable: undefined,
  lockedFooter: undefined,
  group: undefined,
});

const slots = defineSlots<{
  default?: () => unknown;
  header?: () => unknown;
  /** After the header text, at the trailing edge (an action). */
  "header-trailing"?: () => unknown;
  footer?: () => unknown;
}>();

// Read mode of this group: its own `editable`, inside what the form allows. Reactive, unlike a one-time check.
const formEditable = inject(formEditableKey, ref(true));
provide(formEditableKey, computed(() => formEditable.value && props.editable !== false));

const lockedRows = shallowReactive(new Set<Ref<boolean>>());
const hasLocked = computed(() => [...lockedRows].some((locked) => locked.value));

// D22: a record group reads with Edit on its page and renders alone in its sheet.
const recordGroups = useRecordGroups();
const fieldLocks = shallowReactive(new Set<Ref<boolean>>());
const allLocked = computed(() => fieldLocks.size > 0 && [...fieldLocks].every((locked) => locked.value));
const visible = computed(() => !recordGroups?.only.value || recordGroups.only.value === props.group);
const onEdit = computed(() => (props.group && recordGroups?.edit && !allLocked.value ? recordGroups.edit(props.group, props.header ?? "") : null));
// In its own sheet the group's name is the sheet's title.
const inOwnSheet = computed(() => !!props.group && recordGroups?.only.value === props.group);

provide(formGroupKey, {
  hideEmpty: computed(() => props.hideEmpty),
  registerLocked(locked) {
    lockedRows.add(locked);
    return () => lockedRows.delete(locked);
  },
  registerField(field, disabled) {
    fieldLocks.add(disabled);
    const release = props.group && field && recordGroups?.register ? recordGroups.register(props.group, field) : null;
    return () => {
      fieldLocks.delete(disabled);
      release?.();
    };
  },
});
const lockedReason = computed(() => (hasLocked.value ? props.lockedFooter : undefined));

const root = useTemplateRef<HTMLElement>("root");
const id = props.anchor ?? (sectionId(props.header ?? "") || `group-${useId()}`);
if (props.section) useSectionAnchor(id, () => props.header ?? "", root);
</script>

<template>
  <section v-if="visible" ref="root" :id="props.section ? id : undefined" data-test="form-group" class="form-group flex min-w-0 flex-col has-[>.form-group-cell:empty]:hidden"
    :class="{ 'scroll-mt-4': props.section }" :style="{ '--form-label-width': props.labelWidth }">
    <header v-if="!inOwnSheet && (props.header || slots.header || slots['header-trailing'] || onEdit)" class="flex min-w-0 items-end gap-2 px-row-inset pb-2">
      <h3 class="min-w-0 flex-1 text-subheadline font-semibold text-content-strong compact:text-footnote compact:font-normal compact:uppercase compact:tracking-wide compact:text-content-muted">
        <slot name="header">{{ props.header }}</slot>
      </h3>
      <slot name="header-trailing"><GroupEditAction v-if="onEdit" :label="props.group ? recordGroups?.editLabel?.(props.group) : undefined" @click="onEdit()" /></slot>
    </header>
    <div class="form-group-cell rounded-group bg-surface-cell shadow-group"><slot /></div>
    <p v-if="props.footer || slots.footer" class="px-row-inset pt-2 text-footnote text-content-muted text-pretty"><slot name="footer">{{ props.footer }}</slot></p>
    <p v-if="lockedReason" data-test="form-group-locked-footer" class="px-row-inset text-footnote text-content-muted text-pretty" :class="props.footer || slots.footer ? 'pt-1' : 'pt-2'">
      {{ lockedReason }}
    </p>
  </section>
</template>
