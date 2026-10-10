<script setup lang="ts" generic="Name extends string">
import { nextTick, useTemplateRef, watch } from "vue";
import { useI18n } from "vue-i18n";
import Button from "../button/Button.vue";
import FormErrors from "./FormErrors.vue";
import { focusFirstError } from "./focus";
import StepNavigation from "./StepNavigation.vue";
import StepProgress from "./StepProgress.vue";
import type { StepFlow } from "./steps";

/**
 * A form in steps: the progress, the step on screen, and the buttons. Each step's fields go in a slot named after the step, so the
 * step names are checked against the flow's (`#custmer` does not compile). The step slides in from the side the user is coming from
 * (a fade under reduced motion), Enter inside a field is Next, a refused Next puts focus on the first field in error, and a draft
 * the flow brought back says so and offers to start over.
 *
 *   const flow = useStepForm(form, { steps: [{ name: "customer", … }, { name: "vehicle", … }, { name: "review", … }], submit: … });
 *   <StepForm :flow="flow" @cancel="router.back()">
 *     <template #customer><FormGroup>…</FormGroup></template>
 *     <template #vehicle><FormGroup>…</FormGroup></template>
 *     <template #review>…</template>
 *   </StepForm>
 *
 * `progress`: `bar` (default; named steps) or `dots` (steps that depend on answers) or `none` when a dialog renders `StepProgress` in
 * its header. `navigation`: `inline` (default) renders Back, Cancel and Next under the step; `host` leaves them to a `Modal` (`flow.bindDialog()`)
 * or a footer of your own (`StepNavigation`). A new step opens at its top (the progress in view; focus on the step, without scrolling). It works in a `Modal`, a `Sheet` and on a page.
 */
const props = withDefaults(defineProps<{
  flow: StepFlow<Name>;
  progress?: "bar" | "dots" | "none";
  navigation?: "inline" | "host";
}>(), { progress: "bar", navigation: "inline" });

defineEmits<{ cancel: [] }>();
defineSlots<{ [Step in Name]?: () => unknown }>();

const { t } = useI18n();
const body = useTemplateRef<HTMLElement>("body");
const root = useTemplateRef<HTMLElement>("root");

// Whether the form's top is scrolled out above its scroll container (a sheet's body, else the page): only then does it need bringing back,
// so a page that shows the top does not jump. (`scrollIntoView` with `nearest` does nothing for a form taller than the container.)
function topIsAbove(element: HTMLElement): boolean {
  for (let parent = element.parentElement; parent; parent = parent.parentElement) {
    const overflow = getComputedStyle(parent).overflowY;
    if ((overflow === "auto" || overflow === "scroll") && parent.scrollHeight > parent.clientHeight) return element.getBoundingClientRect().top < parent.getBoundingClientRect().top;
  }
  return element.getBoundingClientRect().top < 0;
}

// Moving on or back: the step opens at its top (the progress, the title, then the first field), and focus goes to the step itself
// for screen readers without moving the view (never to a field, which would raise the phone's keyboard before it is wanted).
watch(() => props.flow.current.value.name, async () => {
  await nextTick();
  if (root.value && topIsAbove(root.value)) root.value.scrollIntoView?.({ block: "start" });
  body.value?.focus({ preventScroll: true });
});
// A refused attempt: the first field in error.
watch(() => props.flow.refusals.value, async () => {
  await nextTick();
  if (body.value) await focusFirstError(body.value);
});
</script>

<template>
  <div ref="root" class="flex min-w-0 flex-col gap-group-gap" data-test="step-form" :data-step="props.flow.current.value.name">
    <StepProgress v-if="props.progress !== 'none'" :flow="props.flow" :progress="props.progress" />
    <p class="sr-only" aria-live="polite">{{ props.flow.subtitle.value }}</p>

    <div v-if="props.flow.restored.value" data-test="step-restored" class="flex items-center gap-2 text-footnote text-content-muted">
      <span>{{ t("core.steps.restored") }}</span>
      <Button prominence="link" size="sm" @click="props.flow.restart()">{{ t("core.steps.start_over") }}</Button>
    </div>

    <!-- Keyed by the step: which fields are on screen (and so which errors are "not shown") changes with it. -->
    <FormErrors :key="props.flow.current.value.name" :form="props.flow" />

    <!-- Keyed by the step, so each one is its own element that slides in. -->
    <form :key="props.flow.current.value.name" ref="body" tabindex="-1" novalidate data-test="step-body"
      class="flex min-w-0 flex-col gap-group-gap outline-none"
      :class="props.flow.direction.value === 'back' ? 'animate-step-back' : props.flow.direction.value === 'forward' ? 'animate-step-in' : ''"
      @submit.prevent="props.flow.next()">
      <slot :name="props.flow.current.value.name"></slot>
      <!-- Without a submit button the browser does not submit a form of several fields on Enter. -->
      <button type="submit" class="sr-only" tabindex="-1" aria-hidden="true"></button>
    </form>

    <StepNavigation v-if="props.navigation === 'inline'" :flow="props.flow" @cancel="$emit('cancel')" />
  </div>
</template>
