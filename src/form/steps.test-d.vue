<script setup lang="ts">
// Type fixture (checked by `npm run typecheck`, never built): the step names, the fields a step owns and the slots are checked.
import { computed, ref } from "vue";
import StepForm from "./StepForm.vue";
import { useStepForm } from "./steps";
import { useForm } from "./useForm";

const form = useForm({ defaults: () => ({ name: "", email: "", make: "", budget: null as number | null }) });

const flow = useStepForm(form, {
  steps: [
    { name: "customer", label: "Customer", fields: ["name", "email"] },
    { name: "vehicle", label: "Vehicle", fields: ["make", "budget"] },
    { name: "review", label: "Review" },
  ],
  submit: async (payload) => payload.name,
  onSaved: (saved) => {
    const name: string = saved; // what `submit` resolved with
    void name;
  },
});
// @ts-expect-error a step the flow does not have
void flow.goTo("custmer");
void flow.goTo("review");

// dynamic steps: the names are the union of what the getter can return
const wantsEquipment = ref(false);
const dynamic = useStepForm(form, {
  steps: () => [{ name: "version" as const, label: "Version", fields: ["make" as const] }, ...(wantsEquipment.value ? [{ name: "equipment" as const, label: "Equipment" }] : [])],
  submit: async () => 1,
});
void dynamic.goTo("equipment");
// @ts-expect-error not a step of this flow
void dynamic.goTo("review");

void useStepForm(form, {
  // @ts-expect-error a step cannot own a field the form does not have
  steps: computed(() => [{ name: "customer", label: "Customer", fields: ["nam"] }]),
  submit: async () => 1,
});
</script>

<template>
  <StepForm :flow="flow">
    <template #customer><p>customer fields</p></template>
    <template #vehicle><p>vehicle fields</p></template>
    <template #review><p>review</p></template>
    <!-- @vue-expect-error a slot that is not one of the flow's steps -->
    <template #custmer><p>typo</p></template>
  </StepForm>
</template>
