<script lang="ts">
import type { Permission } from "./index";

/** Exactly one of `permission`, `any` or `all`; the others are not allowed, so two requirements cannot be mixed. */
export type AccessGateProps =
  | { permission: Permission; any?: never; all?: never }
  | { permission?: never; any: readonly Permission[]; all?: never }
  | { permission?: never; any?: never; all: readonly Permission[] };
</script>

<script setup lang="ts">
import { computed } from "vue";
import { usePlatform } from "./platform";

/**
 * Shows its content only when the session's access allows it: one permission, any of several, or all
 * of several. It follows the session, so a permission refresh applies at once. Like a hidden menu
 * item this decides what to offer; the server authorizes every request.
 *
 *   <AccessGate permission="tickets:update"><Button>Edit</Button></AccessGate>
 *   <AccessGate :any="['tickets:update', 'tickets:assign']">...</AccessGate>
 *
 * The `fallback` slot is shown instead when access is missing (a hint, a disabled twin).
 */
const props = defineProps<AccessGateProps>();
const access = usePlatform().access;

const allowed = computed(() => {
  if (props.permission !== undefined) return access.can(props.permission);
  if (props.any !== undefined) return access.canAny(props.any);
  if (props.all !== undefined) return access.canAll(props.all);
  throw new Error("AccessGate needs one of the props permission, any or all.");
});
</script>

<template>
  <slot v-if="allowed" />
  <slot v-else name="fallback" />
</template>
