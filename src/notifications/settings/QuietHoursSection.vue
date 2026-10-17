<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { FormGroup, FormView, SwitchField, TimeField, useForm, type FormValidator } from "../../form";
import { parseTime } from "../../form/date/time";
import { useServerMessages } from "../../i18n";
import SectionIntro from "../../identity/shared/SectionIntro.vue";
import type { QuietHours } from "../../modules/notification/entities";
import type { QuietHoursInput } from "../../modules/notification/schemas";
import { draftOf, minutesOfTime, type QuietDraft } from "./state";

/**
 * Quiet hours: e-mail made inside them waits until they end (the in-app notification never does). On or off, from and to
 * on the clock of the application's time zone, and one line in words. A window may run over midnight; the same time twice is
 * refused on the field. Edited in place and saved as it changes, like the channel switches (the switch at once, a time when it is
 * committed and valid; a change made while a save is on its way follows it): a refusal or a failure puts the last saved values back
 * and is said under the group. Not a sheet: it is one switch and two times, and what they do to the summary is worth seeing as you edit.
 */
const props = defineProps<{ quietHours: QuietHours; timeZone: string; submit: (input: QuietHoursInput) => Promise<QuietHours> }>();

const { t } = useI18n();

const validator: FormValidator<QuietHoursInput> = {
  safeParse(input) {
    const draft = input as QuietDraft;
    const start = minutesOfTime(draft.start);
    const end = minutesOfTime(draft.end);
    const issues = [
      ...(start === null ? [{ path: ["start"], message: t("core.notifications.settings.quiet.required") }] : []),
      ...(end === null ? [{ path: ["end"], message: t("core.notifications.settings.quiet.required") }] : []),
      ...(start !== null && start === end ? [{ path: ["end"], message: t("core.notifications.settings.quiet.same") }] : []),
    ];
    return issues.length > 0 || start === null || end === null ? { success: false, error: { issues } } : { success: true, data: { enabled: draft.enabled, start, end } };
  },
};

const form = useForm({ ...useServerMessages(), defaults: () => draftOf(props.quietHours), validator });

const summary = computed(() => {
  const { enabled, start, end } = form.values;
  const from = parseTime(start);
  const until = parseTime(end);
  if (!enabled) return t("core.notifications.settings.quiet.summary_off");
  if (!from || !until || (from.hour === until.hour && from.minute === until.minute)) return ""; // no sentence for a window the form refuses
  const shown = ({ hour, minute }: { hour: number; minute: number }) => `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
  // Go names the server's own zone "Local": no name a person could read, so the sentence leaves it out.
  const named = props.timeZone && props.timeZone !== "Local";
  return t(`core.notifications.settings.quiet.${named ? "summary_on" : "summary_on_no_zone"}`, { start: shown(from), end: shown(until), zone: props.timeZone });
});

const failure = ref("");
let sending = false;

async function commit() {
  if (sending || !form.dirty.value) return;
  sending = true;
  try {
    while (form.dirty.value) {
      const result = await form.submit((payload) => props.submit(payload));
      if (result.status === "saved") failure.value = "";
      else if (result.status === "failed" && result.failure.error !== null) {
        failure.value = result.failure.message;
        form.reset();
      } else break; // refused by the validator (the fields say why) or cancelled: wait for the next edit
    }
  } finally {
    sending = false;
  }
}

watch(() => [form.values.enabled, form.values.start, form.values.end], commit);
</script>

<template>
  <section class="flex min-w-0 flex-col gap-group-gap" data-notification-quiet-hours>
    <SectionIntro :title="t('core.notifications.settings.quiet.title')" :description="t('core.notifications.settings.quiet.description')" />
    <FormView :form="form" @submit="commit">
      <FormGroup :footer="summary" data-quiet-summary>
        <SwitchField v-bind="form.bind('enabled')" :label="t('core.notifications.settings.quiet.enabled')" />
        <template v-if="form.values.enabled">
          <TimeField v-bind="form.bind('start')" :label="t('core.notifications.settings.quiet.start')" />
          <TimeField v-bind="form.bind('end')" :label="t('core.notifications.settings.quiet.end')" />
        </template>
      </FormGroup>
    </FormView>
    <p v-if="failure" class="px-row-inset text-footnote text-content-destructive" role="alert" data-quiet-failure>{{ failure }}</p>
  </section>
</template>
