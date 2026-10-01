<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { Icon } from "../../icon";

/**
 * Twelve month pills under a year header (the year with arrows), and, when the year is clicked, a grid of twelve years
 * to jump through: 2008 is two clicks away, not eleven. The panel of `MonthYearField` and of the calendar's month title.
 * It only says what was picked; the owner closes it.
 */
const props = withDefaults(
  defineProps<{
    /** The month and year shown as chosen. */
    month?: number | null;
    year?: number | null;
    /** The year the panel opens on when none is chosen. */
    viewYear?: number;
    minYear?: number;
    maxYear?: number;
    /** Months that cannot be picked in a year (the calendar's min and max). */
    monthDisabled?: (year: number, month: number) => boolean;
  }>(),
  { month: null, year: null, viewYear: undefined, minYear: 1, maxYear: 9999, monthDisabled: undefined },
);
const emit = defineEmits<{ pick: [value: { month: number; year: number }] }>();

const { t } = useI18n();
const decade = (year: number) => Math.floor(year / 10) * 10;
const shownYear = ref(clamp(props.year ?? props.viewYear ?? new Date().getFullYear()));
const years = ref(false);
const pageStart = ref(decade(shownYear.value));

watch(
  () => props.year,
  (year) => {
    if (year !== null) shownYear.value = clamp(year);
  },
);

function clamp(year: number) {
  return Math.min(props.maxYear, Math.max(props.minYear, year));
}
const pageYears = computed(() => Array.from({ length: 12 }, (_, index) => pageStart.value + index));

const monthName = (month: number, form: "long" | "short") => t(`core.form.months.${form}.${month}`);
const chosen = (month: number) => props.month === month && props.year === shownYear.value;

function openYears() {
  pageStart.value = decade(shownYear.value);
  years.value = true;
}
function pickYear(year: number) {
  shownYear.value = year;
  years.value = false;
}

const arrow = "flex size-8 cursor-pointer items-center justify-center rounded-control text-content-link hover:bg-fill disabled:cursor-default disabled:text-content-disabled disabled:hover:bg-transparent focus-visible:outline-2 focus-visible:outline-border-focus";
const pill = "min-h-9 cursor-pointer rounded-full px-1 text-subheadline focus-visible:outline-2 focus-visible:outline-border-focus disabled:cursor-default disabled:text-content-disabled disabled:hover:bg-fill";
const pillState = (on: boolean) => (on ? "bg-tint font-semibold text-content-on-tint" : "bg-fill text-content-strong hover:bg-fill-strong");
</script>

<template>
  <div class="flex flex-col gap-2" data-test="month-year-panel">
    <template v-if="!years">
      <div class="flex items-center">
        <button type="button" :disabled="shownYear <= props.minYear" :aria-label="t('core.form.date.previous_year')" :class="arrow" @click="shownYear = clamp(shownYear - 1)">
          <Icon name="arrowLeftSLine" :size="18" />
        </button>
        <button type="button" :aria-label="t('core.form.date.years')" aria-expanded="false"
          class="flex min-h-8 grow cursor-pointer items-center justify-center gap-1 rounded-control text-lg font-semibold tabular-nums hover:bg-fill focus-visible:outline-2 focus-visible:outline-border-focus" @click="openYears">
          {{ shownYear }}<Icon name="arrowDownSLine" :size="14" class="text-content-link" />
        </button>
        <button type="button" :disabled="shownYear >= props.maxYear" :aria-label="t('core.form.date.next_year')" :class="arrow" @click="shownYear = clamp(shownYear + 1)">
          <Icon name="arrowRightSLine" :size="18" />
        </button>
      </div>
      <div class="grid grid-cols-3 gap-1.5">
        <button v-for="number in 12" :key="number" type="button" :aria-pressed="chosen(number)" :aria-label="`${monthName(number, 'long')} ${shownYear}`" :disabled="props.monthDisabled?.(shownYear, number)"
          :class="[pill, pillState(chosen(number))]" @click="emit('pick', { month: number, year: shownYear })">
          {{ monthName(number, "short") }}
        </button>
      </div>
    </template>

    <template v-else>
      <div class="flex items-center">
        <button type="button" :disabled="pageStart <= props.minYear" :aria-label="t('core.form.date.previous_years')" :class="arrow" @click="pageStart -= 12">
          <Icon name="arrowLeftSLine" :size="18" />
        </button>
        <p class="grow text-center text-body font-semibold tabular-nums" aria-live="polite">{{ pageYears[0] }} – {{ pageYears[11] }}</p>
        <button type="button" :disabled="pageStart + 11 >= props.maxYear" :aria-label="t('core.form.date.next_years')" :class="arrow" @click="pageStart += 12">
          <Icon name="arrowRightSLine" :size="18" />
        </button>
      </div>
      <div class="grid grid-cols-3 gap-1.5">
        <button v-for="value in pageYears" :key="value" type="button" :aria-pressed="props.year === value" :disabled="value < props.minYear || value > props.maxYear"
          :class="[pill, 'tabular-nums', pillState(props.year === value || (props.year === null && shownYear === value))]" @click="pickYear(value)">
          {{ value }}
        </button>
      </div>
    </template>
  </div>
</template>
