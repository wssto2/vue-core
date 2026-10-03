<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { Panel } from "../../content";
import { FormGroup, FormView, SwitchField, TimeField, useForm, type FormValidator } from "../../form";
import { parseTime } from "../../form/date/time";
import { useServerMessages } from "../../identity/fieldMessages";
import PanelActions from "../../identity/profile/PanelActions.vue";
import type { QuietHours } from "../../modules/notification/entities";
import type { QuietHoursInput } from "../../modules/notification/schemas";
import { toast } from "../../overlay";
import { draftOf, minutesOfTime, type QuietDraft } from "./state";

/**
 * Quiet hours: e-mail made inside them waits until they end (the in-app notification never does). On or off, from and to
 * on the clock of the application's time zone, and one line in words. A window may run over midnight; the same time twice is
 * refused on the field. Saved with the button, like the profile's panels.
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

async function save() {
  const result = await form.submit((payload) => props.submit(payload));
  if (result.status === "saved") {
    form.hydrate(draftOf(result.value));
    toast.success(t("core.notifications.settings.quiet.saved"));
  }
}
</script>

<template>
  <Panel :title="t('core.notifications.settings.quiet.title')" icon="moonLine" data-notification-quiet-hours>
    <FormView :form="form" @submit="save">
      <FormGroup :footer="summary" data-quiet-summary>
        <SwitchField v-bind="form.bind('enabled')" :label="t('core.notifications.settings.quiet.enabled')" />
        <template v-if="form.values.enabled">
          <TimeField v-bind="form.bind('start')" :label="t('core.notifications.settings.quiet.start')" />
          <TimeField v-bind="form.bind('end')" :label="t('core.notifications.settings.quiet.end')" />
        </template>
      </FormGroup>
    </FormView>
    <template #footer><PanelActions :label="t('core.notifications.settings.quiet.submit')" :processing="form.submitting.value" :dirty="form.dirty.value" @submit="save" @cancel="form.reset()" /></template>
  </Panel>
</template>
