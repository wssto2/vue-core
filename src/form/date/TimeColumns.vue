<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { HOURS, makeTime, minutesOf, parseTime, type Time } from "./time";
import ValueColumn from "./ValueColumn.vue";

/**
 * The hour and the minute of a time to pick from: two scrolling lists in a popover, or two drums on a phone. Every minute
 * is offered unless `step` says otherwise. The value is `"HH:mm"`; picking an hour or a minute on its own keeps the other
 * (and starts from 00 where there is none yet).
 */
const props = withDefaults(defineProps<{ step?: number; variant?: "list" | "wheel" }>(), { step: 1, variant: "list" });
const model = defineModel<Time | null>({ default: null });

const { t } = useI18n();
const parts = computed(() => parseTime(model.value));
const minutes = computed(() => minutesOf(props.step));

const hour = computed({
  get: () => parts.value?.hour ?? null,
  set: (value) => {
    if (value !== null) model.value = makeTime(value, parts.value?.minute ?? 0);
  },
});
const minute = computed({
  get: () => parts.value?.minute ?? null,
  set: (value) => {
    if (value !== null) model.value = makeTime(parts.value?.hour ?? 0, value);
  },
});
</script>

<template>
  <div v-if="props.variant === 'list'" class="flex h-49 gap-1.5" data-test="time-columns">
    <ValueColumn v-model="hour" :values="HOURS" :label="t('core.form.time.hour')" />
    <ValueColumn v-model="minute" :values="minutes" :label="t('core.form.time.minute')" />
  </div>
  <div v-else class="relative flex items-center justify-center gap-1" data-test="time-columns">
    <div class="pointer-events-none absolute inset-x-0 h-9 rounded-lg bg-fill" aria-hidden="true" />
    <ValueColumn v-model="hour" :values="HOURS" :label="t('core.form.time.hour')" variant="wheel" class="relative" />
    <span class="relative text-[22px] font-semibold" aria-hidden="true">:</span>
    <ValueColumn v-model="minute" :values="minutes" :label="t('core.form.time.minute')" variant="wheel" class="relative" />
  </div>
</template>
