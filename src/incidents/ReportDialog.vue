<script setup lang="ts">
import { computed, onMounted, watch } from "vue";
import { useI18n } from "vue-i18n";
import { CommandDialog, FormGroup, SelectField, TextareaField, TextField, useCommand, type SelectOption } from "../form";
import type { Incident } from "../modules/incident/entities";
import { toast } from "../overlay";
import { usePlatform } from "../platform";
import { MANAGE_INCIDENTS } from "./access";
import { useIncidentsApi } from "./api";
import { useIncidentsContext } from "./context";
import { reportFormDefaults, requiredText, type ReportForm } from "./form";
import { SEVERITY_LABELS } from "./look";

/**
 * "Report a problem": a title, what happened and how bad it is; the page and the browser are filled in. Whoever holds
 * `incident:manage` (the staff) also sees the advanced fields: module, steps, expected and actual result, version and the
 * browser's own error. `autoOpen` opens it as it mounts, for the host that mounts it only while it is wanted (a permanent
 * template ref to a component whose root is a teleport loops).
 */
const props = defineProps<{ autoOpen?: boolean }>();
const emit = defineEmits<{ created: [incident: Incident]; close: [] }>();

const { t } = useI18n();
const { access } = usePlatform();
const api = useIncidentsApi();
const { appVersion } = useIncidentsContext();

const advanced = computed(() => access.can(MANAGE_INCIDENTS));
const severityOptions = computed<SelectOption<string>[]>(() => Object.entries(SEVERITY_LABELS).map(([value, label]) => ({ value, label: t(label) })));

// A command with inputs (a report is sent, never edited).
const report = useCommand({
  defaults: () => reportFormDefaults(appVersion),
  validator: requiredText<ReportForm>(["title", "description"], t("core.account.validation.required")),
  run: (input, { idempotencyKey }) => api.report(input, idempotencyKey),
  done: (incident) => {
    toast.success(t("core.incidents.toasts.report_success"));
    emit("created", incident);
  },
});
const form = report.form;

const show = () => report.present();
const hide = () => report.dismiss();

onMounted(() => {
  if (props.autoOpen) show();
});
watch(() => report.open.value, (open, was) => {
  if (was && !open) emit("close");
});

defineExpose({ show, hide });
</script>

<template>
  <CommandDialog :command="report" size="md" :title="t('core.incidents.report_modal.title')" :subtitle="t('core.incidents.report_modal.description')"
    :confirm-label="t('core.incidents.report_modal.submit')">
    <div class="flex flex-col gap-group-gap" data-test="incident-report">
      <FormGroup>
        <TextField v-bind="form.bind('title')" :label="t('core.incidents.fields.title')" required :max-length="255" />
        <TextareaField v-bind="form.bind('description')" :label="t('core.incidents.fields.description')" required :rows="4" :max-length="20000" />
        <SelectField v-bind="form.bind('severity')" :label="t('core.incidents.fields.severity')" :options="severityOptions" />
      </FormGroup>

      <FormGroup v-if="advanced" :header="t('core.incidents.report_modal.advanced_fields')">
        <TextField v-bind="form.bind('affected_module')" :label="t('core.incidents.fields.affected_module')" :max-length="100" />
        <TextField v-bind="form.bind('page_url')" :label="t('core.incidents.fields.page_url')" :max-length="1000" />
        <TextareaField v-bind="form.bind('steps_to_reproduce')" :label="t('core.incidents.fields.steps_to_reproduce')" :rows="3" :max-length="20000" />
        <TextareaField v-bind="form.bind('expected_result')" :label="t('core.incidents.fields.expected_result')" :rows="2" :max-length="20000" />
        <TextareaField v-bind="form.bind('actual_result')" :label="t('core.incidents.fields.actual_result')" :rows="2" :max-length="20000" />
        <TextField v-bind="form.bind('browser_info')" :label="t('core.incidents.fields.browser_info')" :max-length="500" />
        <TextField v-bind="form.bind('app_version')" :label="t('core.incidents.fields.app_version')" :max-length="100" />
        <TextareaField v-bind="form.bind('frontend_error_message')" :label="t('core.incidents.fields.frontend_error_message')" :rows="2" :max-length="2000" />
        <TextareaField v-bind="form.bind('frontend_stacktrace')" :label="t('core.incidents.fields.frontend_stacktrace')" :rows="4" :max-length="20000" />
      </FormGroup>
    </div>
  </CommandDialog>
</template>
