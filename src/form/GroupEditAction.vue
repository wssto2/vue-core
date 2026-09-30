<script setup lang="ts">
import { useI18n } from "vue-i18n";
import Button from "../button/Button.vue";

/**
 * The group's **Edit** (decision D22): a record changes where it reads, so each group that can change carries this in its
 * header and opens a sheet with that group alone. `FormGroup` with a `group` shows it by itself; use it directly in
 * `#header-trailing` for a group that is not wired to the record page.
 *
 *   <FormGroup :header="t('identification')"><template #header-trailing><GroupEditAction :allowed="can('vehicle:update')" @click="sheet.present()" /></template>…</FormGroup>
 *
 * Hidden, not disabled, when the viewer may not edit or the group is `locked`: a group that cannot change reads like any
 * other, and its locked footer says why.
 */
const props = withDefaults(defineProps<{
  /** Whether the viewer may change the group (the feature's `can(…)`). */
  allowed?: boolean;
  locked?: boolean;
  /** Defaults to "Edit". */
  label?: string;
}>(), { allowed: true, locked: false, label: undefined });

const emit = defineEmits<{ click: [] }>();
const { t } = useI18n();
</script>

<template>
  <Button v-if="props.allowed && !props.locked" prominence="plain" size="sm" data-test="group-edit" @click="emit('click')">{{ props.label ?? t("core.actions.edit") }}</Button>
</template>
