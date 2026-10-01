<script setup lang="ts" generic="Name extends string">
import { useI18n } from "vue-i18n";
import Button from "../button/Button.vue";
import type { StepFlow } from "./steps";

/**
 * The buttons of a step-by-step form that is not in a `Modal`: Back (named after the step it leads to), Cancel, and Next (named
 * after the step it leads to, or the flow's submit label on the last). `StepForm` renders it by default; a `Sheet` or a page
 * with a footer of its own renders it there with `StepForm navigation="host"`.
 *
 *   <StepNavigation :flow="flow" @cancel="router.back()" />
 */
const props = defineProps<{ flow: StepFlow<Name> }>();
defineEmits<{ cancel: [] }>();
const { t } = useI18n();
</script>

<template>
  <div class="flex flex-wrap items-center gap-2.5 border-t border-border-separator pt-3.5" data-test="step-navigation">
    <Button v-if="props.flow.backLabel.value" prominence="plain" icon="arrowLeftSLine" :disabled="props.flow.busy.value" data-test="step-back" @click="props.flow.back()">{{ props.flow.backLabel.value }}</Button>
    <div class="grow"></div>
    <Button prominence="plain" data-test="step-cancel" @click="$emit('cancel')">{{ t("core.actions.cancel") }}</Button>
    <Button prominence="primary" :processing="props.flow.busy.value" data-test="step-next" @click="props.flow.next()">{{ props.flow.nextLabel.value }}</Button>
  </div>
</template>
