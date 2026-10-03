<script setup lang="ts">
import { computed } from "vue";
import { IconTile } from "../controls";
import { FormRow } from "../form";
import type { Binding } from "../modules/access/entities";
import { useAccessLabels } from "./labels";

/**
 * One role a person holds and where it applies, read-only: the role's name, its kind under it, the place on the right. The
 * access panel puts *Remove* in the trailing slot; a profile page shows it as it is.
 */
const props = defineProps<{ binding: Pick<Binding, "role" | "scope"> }>();
defineSlots<{ trailing?: () => unknown }>();

const labels = useAccessLabels();
const sub = computed(() => [labels.roleKind(props.binding.role), ...props.binding.role.attrs.map((attr) => `${attr.attribute}: ${attr.values.join(", ")}`)].join(" · "));
</script>

<template>
  <FormRow layout="setting" :label="labels.roleName(props.binding.role)" :sub="sub">
    <template #leading><IconTile :tone="props.binding.role.predefined ? 'anchor' : 'brand'" icon="shieldStarFill" /></template>
    <span class="text-right text-footnote text-content-muted" data-test="binding-scope">{{ labels.scopeLabel(props.binding.scope) }}</span>
    <template v-if="$slots.trailing" #trailing><slot name="trailing" /></template>
  </FormRow>
</template>
