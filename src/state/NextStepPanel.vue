<script setup lang="ts">
import { Button } from "../button";
import { Icon } from "../icon";
import { useI18n } from "vue-i18n";
import { Avatar } from "../content";

/**
 * NextStepPanel — a workflow record's one "Što dalje?" box (VEHICLE_WORKFLOW_PLAN W2, decision
 * D2; prototype `UvPreparationADesktop` and the appraisal's `AppraisalResultDesktop`): what the
 * next step does, one primary action, and — when it cannot be taken — why, right under it.
 *
 *   <next-step-panel :body="t('…activate_body')" :action="{ label: t('…activate') , disabled }"
 *     :reason="blockedReason" :note="t('core.next_step.menu_hint', { action })" @act="open" />
 *
 * - A disabled action always says why (`reason`, D2); it is never hidden.
 * - `handoff` (D3): the step is someone else's. The panel names them instead of offering an
 *   action the user may not take; pass no `action` then.
 * - The default slot replaces or follows the action (the appraisal's two buttons).
 * - `note`: a quiet line under a separator ("„Vrati u preuzimanje” je u izborniku ⋯.").
 *
 * The feature owns the wording, the policies and what the action opens.
 */
const props = withDefaults(defineProps<{
  title?: string;
  body?: string;
  action?: { label: string; disabled?: boolean; processing?: boolean; testId?: string };
  reason?: string;
  handoff?: { name: string; text: string };
  note?: string;
}>(), { title: undefined, body: undefined, action: undefined, reason: undefined, handoff: undefined, note: undefined });

const emit = defineEmits<{ act: [] }>();
const { t } = useI18n();
</script>

<template>
  <aside class="flex min-w-0 flex-col gap-3 rounded-group bg-surface-cell p-4 shadow-group" data-test="next-step">
    <h2 class="text-headline font-semibold text-content-strong">{{ props.title ?? t("core.next_step.title") }}</h2>
    <p v-if="props.body" class="text-footnote text-content-muted" data-test="next-step-body">{{ props.body }}</p>

    <div v-if="props.handoff" class="flex items-start gap-3 rounded-control bg-fill px-3 py-2.5" data-test="next-step-handoff">
      <Avatar :name="props.handoff.name" size="sm" />
      <p class="min-w-0 flex-1 text-footnote text-content">{{ props.handoff.text }}</p>
    </div>

    <Button v-if="props.action" prominence="primary" class="w-full justify-center"
      :disabled="props.action.disabled" :processing="props.action.processing"
      :icon="props.action.disabled ? 'lockLine' : undefined" v-bind="{ 'data-test': props.action.testId ?? 'next-step-action' }"
      @click="emit('act')">
      {{ props.action.label }}
    </Button>
    <p v-if="props.reason" class="text-footnote text-status-warning-content" data-test="next-step-reason">{{ props.reason }}</p>

    <slot />

    <p v-if="props.note" class="flex items-start gap-2 border-t border-border-separator pt-3 text-footnote text-content-muted" data-test="next-step-note">
      <Icon name="informationLine" :size="16" class="mt-px shrink-0" />
      <span>{{ props.note }}</span>
    </p>
  </aside>
</template>
