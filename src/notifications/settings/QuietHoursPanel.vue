<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { Panel } from "../../content";
import { useFormat } from "../../format";
import { FormView, SwitchField, TimeField, useForm, type FormValidator } from "../../form";
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
const format = useFormat();

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
  if (!from || !until) return "";
  const shown = ({ hour, minute }: { hour: number; minute: number }) => format.time(new Date(2000, 0, 1, hour, minute));
  return t("core.notifications.settings.quiet.summary_on", { start: shown(from), end: shown(until), zone: props.timeZone });
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
      <SwitchField v-bind="form.bind('enabled')" :label="t('core.notifications.settings.quiet.enabled')" />
      <div v-if="form.values.enabled" class="grid grid-cols-2 gap-3">
        <TimeField v-bind="form.bind('start')" :label="t('core.notifications.settings.quiet.start')" />
        <TimeField v-bind="form.bind('end')" :label="t('core.notifications.settings.quiet.end')" />
      </div>
      <p class="text-footnote text-content-muted" data-quiet-summary>{{ summary }}</p>
    </FormView>
    <template #footer><PanelActions :label="t('core.notifications.settings.quiet.submit')" :processing="form.submitting.value" :dirty="form.dirty.value" @submit="save" @cancel="form.reset()" /></template>
  </Panel>
</template>
