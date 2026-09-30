<script setup lang="ts">
import { computed, provide, toRef } from "vue";
import { formEditableKey } from "./field";
import { recordGroupsKey } from "./recordGroups";

/**
 * The inside of a record's group sheet: the record's own sections render in it, but only the `FormGroup` whose `group` is
 * `only` shows, and the fields edit (or read, when the group cannot change). One record page can serve the read view and
 * every group's sheet from the same markup.
 *
 *   <RecordGroupScope :only="group" :editable="canEdit"><ContactSections :form="form" /></RecordGroupScope>
 */
const props = defineProps<{ only: string; editable: boolean }>();
defineSlots<{ default?: () => unknown }>();

provide(recordGroupsKey, { only: toRef(props, "only") });
provide(formEditableKey, computed(() => props.editable));
</script>

<template>
  <div class="flex min-w-0 flex-col gap-group-gap" data-test="record-group-scope" :data-group="props.only"><slot /></div>
</template>
