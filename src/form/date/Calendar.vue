<script setup lang="ts">
import { intlLocale } from "../../internal/intlLocale";
import { computed, nextTick, ref, useId, useTemplateRef, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useFormat } from "../../format";
import { Icon } from "../../icon";
import {
  addMonths,
  clampDay,
  daysInMonth,
  endOfMonth,
  firstWeekday,
  isDay,
  makeDay,
  monthGrid,
  moveDay,
  parseDay,
  today,
  weekendDays,
  type Day,
  type DayRules,
  type DisabledDates,
} from "./days";
import MonthYearPanel from "./MonthYearPanel.vue";

/**
 * A month of days to pick one from, with no dependency: the weeks start on the locale's first weekday, days outside `min`
 * and `max` (or in `disabledDates`) cannot be picked, an empty calendar opens on today's month (or `openOn`), never on
 * `min`'s. The keyboard is the WAI-ARIA date picker's: arrows move by a day or a week, Page Up and Down by a month (with
 * Shift a year), Home and End to the week's ends, Enter or Space picks. The value is a day as text, `"2026-09-30"`.
 *
 *   <Calendar v-model="day" min="2026-01-01" :disabled-dates="[{ from: '2026-12-24', to: '2026-12-26' }]" />
 *
 * The date fields put it in a popover or a sheet; use it directly for a calendar that is always on screen.
 */
const props = withDefaults(
  defineProps<{
    min?: Day | null;
    max?: Day | null;
    disabledDates?: DisabledDates;
    /** The month an empty calendar opens on. */
    openOn?: Day | null;
    /** `touch` for fingers: larger days. */
    size?: "regular" | "touch";
    /** The month title opens a grid of months and years to jump through. */
    monthPicker?: boolean;
  }>(),
  { min: null, max: null, disabledDates: undefined, openOn: null, size: "regular", monthPicker: false },
);

const model = defineModel<Day | null>({ default: null });

const { t } = useI18n();
const format = useFormat();
const titleId = useId();
const grid = useTemplateRef<HTMLElement>("grid");

const rules = computed<DayRules>(() => ({ min: props.min, max: props.max, disabled: props.disabledDates }));
const first = computed(() => firstWeekday(format.locale));

function startingDay(): Day {
  if (isDay(model.value)) return model.value;
  return clampDay(isDay(props.openOn) ? props.openOn : today(), rules.value);
}
const initial = parseDay(startingDay())!;
const view = ref({ year: initial.year, month: initial.month });
const focused = ref<Day>(startingDay());
const jumping = ref(false);

watch(model, (day) => {
  if (isDay(day)) show(day);
});

function show(day: Day) {
  const civil = parseDay(day)!;
  view.value = { year: civil.year, month: civil.month };
  focused.value = day;
}

const weeks = computed(() =>
  monthGrid(view.value.year, view.value.month, { firstWeekday: first.value, weekend: weekendDays(format.locale), today: today(), selected: model.value, rules: rules.value }),
);
const monthStart = computed(() => makeDay(view.value.year, view.value.month, 1) ?? "1970-01-01");
/** The one day in the tab order: the focused one while it is on screen, else the first of the month. */
const tabbable = computed(() => (focused.value.startsWith(monthStart.value.slice(0, 7)) ? focused.value : monthStart.value));

const title = computed(() => t("core.form.months.with_year", { month: t(`core.form.months.long.${view.value.month}`), year: view.value.year }));
const weekdays = computed(() => {
  const names = new Intl.DateTimeFormat(intlLocale(format.locale), { weekday: "short", timeZone: "UTC" });
  // 2026-09-28 is a Monday; a short name is cut to two letters ("pon" → "Po").
  return Array.from({ length: 7 }, (_, offset) => {
    const day = new Date(Date.UTC(2026, 8, 28 + ((first.value - 1 + offset) % 7)));
    const name = names.format(day).replace(/\.$/, "");
    return name.charAt(0).toLocaleUpperCase(intlLocale(format.locale)) + name.slice(1, 2);
  });
});
const label = computed(() => {
  const full = new Intl.DateTimeFormat(intlLocale(format.locale), { dateStyle: "full", timeZone: "UTC" });
  return (day: Day) => {
    const civil = parseDay(day)!;
    return full.format(new Date(Date.UTC(civil.year, civil.month - 1, civil.day)));
  };
});

const canGoBack = computed(() => !props.min || endOfMonth(addMonths(monthStart.value, -1)) >= props.min);
const canGoForward = computed(() => !props.max || addMonths(monthStart.value, 1) <= props.max);

async function go(day: Day, refocus: boolean) {
  show(day);
  if (!refocus) return;
  await nextTick();
  focus();
}

function focus() {
  grid.value?.querySelector<HTMLElement>(`[data-day="${tabbable.value}"]`)?.focus();
}

function onKeydown(event: KeyboardEvent) {
  if (event.altKey || event.ctrlKey || event.metaKey) return;
  const next = moveDay(tabbable.value, event.key, event.shiftKey, first.value);
  if (!next) return;
  event.preventDefault();
  void go(clampDay(next, rules.value), true);
}

const step = (count: number) => go(clampDay(addMonths(tabbable.value, count), rules.value), false);

function pick(day: Day, disabled: boolean) {
  focused.value = day;
  if (!disabled) model.value = day;
}

function jump(value: { month: number; year: number }) {
  const day = makeDay(value.year, value.month, Math.min(Number(tabbable.value.slice(8)), daysInMonth(value.year, value.month)));
  jumping.value = false;
  void go(clampDay(day ?? monthStart.value, rules.value), true);
}

const monthDisabled = (year: number, month: number) => {
  const start = makeDay(year, month, 1) ?? "";
  return (!!props.max && start > props.max) || (!!props.min && endOfMonth(start) < props.min);
};

defineExpose({ focus });

const touch = computed(() => props.size === "touch");
const arrow = "flex shrink-0 cursor-pointer items-center justify-center rounded-control text-content-link hover:bg-fill disabled:cursor-default disabled:text-content-disabled disabled:hover:bg-transparent focus-visible:outline-2 focus-visible:outline-border-focus";

function cellClass(cell: { selected: boolean; today: boolean; inMonth: boolean; weekend: boolean; disabled: boolean }) {
  if (cell.selected) return "bg-tint font-semibold text-content-on-tint";
  const tone = cell.disabled ? "cursor-default text-content-disabled line-through decoration-1" : cell.inMonth ? (cell.weekend ? "text-content-muted" : "text-content-strong") : "text-content-disabled";
  const ring = cell.today ? "font-bold text-content-link ring-[1.5px] ring-inset ring-tint" : "";
  return [tone, ring, cell.disabled ? "" : "hover:bg-fill"].join(" ");
}
</script>

<template>
  <div class="flex flex-col" :class="touch ? 'gap-1' : 'gap-2'" data-test="calendar">
    <div class="flex items-center gap-1" :class="touch ? 'px-1' : ''">
      <button v-if="props.monthPicker" type="button" :aria-expanded="jumping" :aria-label="t('core.form.date.choose_month')"
        class="flex min-h-8 cursor-pointer items-center gap-1 rounded-control px-1.5 py-1 text-lg font-semibold hover:bg-fill focus-visible:outline-2 focus-visible:outline-border-focus" @click="jumping = !jumping">
        <span :id="titleId" aria-live="polite">{{ title }}</span>
        <Icon name="arrowDownSLine" :size="14" class="text-content-link" />
      </button>
      <p v-else :id="titleId" aria-live="polite" class="ml-1.5 font-semibold" :class="touch ? 'text-headline' : 'text-lg'">{{ title }}</p>
      <span class="grow" />
      <template v-if="!jumping">
        <button type="button" :disabled="!canGoBack" :aria-label="t('core.form.date.previous_month')" :class="[arrow, touch ? 'size-11' : 'size-8']" @click="step(-1)"><Icon name="arrowLeftSLine" :size="touch ? 22 : 18" /></button>
        <button type="button" :disabled="!canGoForward" :aria-label="t('core.form.date.next_month')" :class="[arrow, touch ? 'size-11' : 'size-8']" @click="step(1)"><Icon name="arrowRightSLine" :size="touch ? 22 : 18" /></button>
      </template>
    </div>

    <MonthYearPanel v-if="jumping" :month="view.month" :year="view.year" :min-year="props.min ? Number(props.min.slice(0, 4)) : 1" :max-year="props.max ? Number(props.max.slice(0, 4)) : 9999"
      :month-disabled="monthDisabled" @pick="jump" />

    <div v-else ref="grid" role="grid" :aria-labelledby="titleId" class="flex flex-col" :class="touch ? 'gap-y-1' : 'gap-0.5'" @keydown="onKeydown">
      <div role="row" class="grid grid-cols-7 text-center" :class="touch ? '' : 'gap-0.5'">
        <div v-for="(name, index) in weekdays" :key="index" role="columnheader" class="py-1 font-semibold text-content-disabled" :class="touch ? 'text-footnote' : 'text-caption'">{{ name }}</div>
      </div>
      <div v-for="(week, index) in weeks" :key="index" role="row" class="grid grid-cols-7" :class="touch ? '' : 'gap-0.5'">
        <div v-for="cell in week" :key="cell.day" role="gridcell" :aria-selected="cell.selected">
          <button type="button" :data-day="cell.day" :aria-label="label(cell.day)" :aria-current="cell.today ? 'date' : undefined" :aria-disabled="cell.disabled || undefined"
            :tabindex="cell.day === tabbable ? 0 : -1"
            class="w-full cursor-pointer rounded-full tabular-nums transition-colors duration-motion-fast focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-border-focus"
            :class="[touch ? 'h-11 text-body' : 'h-9 text-body', cellClass(cell)]" @click="pick(cell.day, cell.disabled)">
            {{ cell.date }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
