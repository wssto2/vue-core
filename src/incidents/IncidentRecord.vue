<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { useRoute } from "vue-router";
import { Button } from "../button";
import { useCollectionNeighbors } from "../collection";
import { KeyValue, Panel } from "../content";
import { IconTile } from "../controls";
import { FormErrors, FormGroup, FormView, SelectField, TextareaField, TextField, useCommand, useLeaveGuard, useResourceForm, useSaveChrome } from "../form";
import { useFormat } from "../format";
import { toast } from "../overlay";
import { RecordHeader } from "../page";
import { usePlatform } from "../platform";
import { ResourcePage, useRouteResource } from "../resource";
import { Badge, EmptyState } from "../state";
import { MANAGE_INCIDENTS, UPDATE_INCIDENTS } from "./access";
import { incidentList, useIncidentsApi, type IncidentDetail } from "./api";
import { commentFormDefaults, managementDefaults, managementDraft, requiredText, type CommentForm } from "./form";
import { SEVERITY_LABELS, SEVERITY_TONES, SOURCE_LABELS, STATUS_LABELS, STATUS_TONES } from "./look";
import Person from "./Person.vue";
import { incidentsRoutes } from "./routes";

/**
 * An incident (`/incidents/:incidentID`): what happened, the reports people filed on it, its comments (internal ones are the staff's),
 * a summary, and, for whoever holds `incident:update`, the management form (status, severity, who may see it, the resolution, the external
 * ticket). It is opened from the list with previous / next within the list's result set. Comments are added without editing the incident.
 */
const { t } = useI18n();
const route = useRoute();
const { http, access } = usePlatform();
const format = useFormat();
const api = useIncidentsApi();

// The incident, its user reports and its comments come in one read (the comments are not a read of their own).
const resource = useRouteResource<IncidentDetail>({ param: "incidentID", load: (id, { signal }) => api.show(id, { signal }), identify: (record) => record.incident.id });
// Opened from the list: previous/next within its result set (the list's own definition replays its state from `?from=`), and back to it.
const neighbors = useCollectionNeighbors(incidentList(http), { current: () => resource.id.value, list: incidentsRoutes.index, param: "incidentID", backLabel: () => t("core.incidents.title") });

const incidentID = Number(route.params.incidentID);
// The staff hold incident:manage, as the server's filter does.
const isStaff = computed(() => access.can(MANAGE_INCIDENTS));
const canUpdate = computed(() => access.can(UPDATE_INCIDENTS));

const incident = computed(() => resource.data.value?.incident ?? null);
const reports = computed(() => resource.data.value?.reports ?? []);
const comments = computed(() => resource.data.value?.comments ?? []);

// The management form, over the page's incident (no second read): a save puts the stored incident in the page, and the page reads again
// for what the update does not return (the people). The 422 of a field lands on that field.
const management = useResourceForm({
  source: resource,
  defaults: managementDefaults,
  toValues: managementDraft,
  save: async (payload, record, { idempotencyKey }) => ({ ...record, incident: await api.update(incidentID, payload, idempotencyKey) }),
});

async function saveManagement() {
  const result = await management.save({ refresh: () => resource.reload() });
  if (result.status === "saved") toast.success(t("core.actions.saved"));
}
useSaveChrome({ form: management, label: () => t("core.incidents.actions.save"), allowed: canUpdate, ready: () => !!incident.value, save: () => void saveManagement() });

// A comment adds to the incident, it does not edit it: a command, sent from its own button, the text kept on a failure.
const comment = useCommand({
  defaults: commentFormDefaults,
  validator: requiredText<CommentForm>(["body"], t("core.account.validation.required")),
  run: (input, { idempotencyKey }) => api.comment(incidentID, input, idempotencyKey),
  done: async () => {
    comment.form.hydrate(commentFormDefaults());
    await resource.reload();
  },
});
// An unsent comment asks before leaving or paging to another incident (the management form's guard is in its save chrome).
useLeaveGuard(() => comment.form.values.body.trim() !== "");

const options = (labels: Readonly<Record<string, string>>) => computed(() => Object.entries(labels).map(([value, label]) => ({ value, label: t(label) })));
const statusOptions = options(STATUS_LABELS);
const severityOptions = options(SEVERITY_LABELS);
const visibilityOptions = options({ reporter_and_staff: "core.incidents.visibilities.reporter_and_staff", staff_only: "core.incidents.visibilities.staff_only" });
const commentVisibilityOptions = options({ public: "core.incidents.comment_visibilities.public", internal: "core.incidents.comment_visibilities.internal" });
const ticketProviderOptions = options({ none: "core.incidents.ticket_providers.none", github: "core.incidents.ticket_providers.github", jira: "core.incidents.ticket_providers.jira" });

const named = (labels: Readonly<Record<string, string>>, value: string) => t(labels[value] ?? value);
</script>

<template>
  <ResourcePage :resource="resource" :title="incident?.title ?? t('core.incidents.title')" :list="neighbors.context">
    <template #header="{ record }">
      <!-- A phone shows the subtitle, not the badges: it carries severity and status too. -->
      <RecordHeader :title="record.incident.title"
        :subtitle="[record.incident.public_code, named(SEVERITY_LABELS, record.incident.severity), named(STATUS_LABELS, record.incident.status)].join(' · ')">
        <template #leading><IconTile tone="neutral" icon="alertTriangle" size="lg" /></template>
        <template #meta>
          <span class="tabular-nums">{{ record.incident.public_code }}</span>
          <Badge :tone="SEVERITY_TONES[record.incident.severity] ?? 'neutral'">{{ named(SEVERITY_LABELS, record.incident.severity) }}</Badge>
          <Badge :tone="STATUS_TONES[record.incident.status] ?? 'neutral'" dot>{{ named(STATUS_LABELS, record.incident.status) }}</Badge>
        </template>
      </RecordHeader>
    </template>

    <div class="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_300px]" data-test="incident">
      <!-- Main content -->
      <div class="flex min-w-0 flex-col gap-6">
        <Panel v-if="incident" :title="t('core.incidents.details.overview')">
          <div class="flex flex-col gap-3 text-sm">
            <p class="whitespace-pre-line text-content">{{ incident.description }}</p>
            <dl class="grid grid-cols-2 gap-x-6 gap-y-3">
              <KeyValue v-if="incident.affected_module" :label="t('core.incidents.fields.affected_module')" :value="incident.affected_module" />
              <KeyValue v-if="incident.affected_route" :label="t('core.incidents.fields.affected_route')"><span class="font-mono">{{ incident.affected_route }}</span></KeyValue>
              <KeyValue v-if="incident.environment" :label="t('core.incidents.fields.environment')" :value="incident.environment" />
              <KeyValue v-if="incident.error_class" :label="t('core.incidents.fields.error_class')"><span class="font-mono">{{ incident.error_class }}</span></KeyValue>
            </dl>
            <dl class="flex flex-col gap-3">
              <KeyValue v-if="incident.error_message_sample" :label="t('core.incidents.fields.error_message_sample')"><span class="whitespace-pre-line font-mono">{{ incident.error_message_sample }}</span></KeyValue>
              <KeyValue v-if="incident.stacktrace_sample" :label="t('core.incidents.fields.stacktrace_sample')">
                <pre class="mt-1 overflow-x-auto whitespace-pre-wrap rounded-control bg-fill p-3 font-mono text-xs font-normal">{{ incident.stacktrace_sample }}</pre>
              </KeyValue>
            </dl>
          </div>
        </Panel>

        <Panel :title="t('core.incidents.details.user_reports')" flush>
          <EmptyState v-if="reports.length === 0" :title="t('core.incidents.details.no_reports')" icon="fileTextLine" />
          <template v-else>
            <div v-for="item in reports" :key="item.id" class="p-4 not-last:border-b not-last:border-border-separator" data-test="incident-report-item">
              <div class="mb-2 flex items-center justify-between gap-3">
                <Person v-if="item.reporter" :person="item.reporter" />
                <span class="text-xs text-content-muted">{{ format.dateTime(item.created_at) }}</span>
              </div>
              <p class="text-sm font-semibold text-content-strong">{{ item.title }}</p>
              <p class="whitespace-pre-line text-sm text-content">{{ item.description }}</p>
              <dl class="mt-3 flex flex-col gap-2">
                <KeyValue v-if="item.steps_to_reproduce" :label="t('core.incidents.fields.steps_to_reproduce')"><span class="whitespace-pre-line font-normal">{{ item.steps_to_reproduce }}</span></KeyValue>
                <KeyValue v-if="item.expected_result" :label="t('core.incidents.fields.expected_result')"><span class="whitespace-pre-line font-normal">{{ item.expected_result }}</span></KeyValue>
                <KeyValue v-if="item.actual_result" :label="t('core.incidents.fields.actual_result')"><span class="whitespace-pre-line font-normal">{{ item.actual_result }}</span></KeyValue>
              </dl>
            </div>
          </template>
        </Panel>

        <Panel :title="t('core.incidents.details.comments')" flush>
          <EmptyState v-if="comments.length === 0" :title="t('core.incidents.details.no_comments')" icon="chat4Fill" />
          <template v-else>
            <div v-for="item in comments" :key="item.id" class="p-4 not-last:border-b not-last:border-border-separator" data-test="incident-comment-item">
              <div class="mb-2 flex items-center justify-between gap-3">
                <Person v-if="item.author" :person="item.author" />
                <span class="text-xs text-content-muted">{{ format.dateTime(item.created_at) }}</span>
              </div>
              <p class="whitespace-pre-line text-sm text-content-strong">{{ item.body }}</p>
              <span v-if="item.visibility === 'internal'" class="mt-2 inline-flex">
                <Badge tone="neutral">{{ t("core.incidents.comment_visibilities.internal") }}</Badge>
              </span>
            </div>
          </template>

          <div class="flex flex-col gap-3 border-t border-border-separator p-4" data-test="incident-comment">
            <FormErrors :form="comment.form" />
            <TextareaField v-bind="comment.form.bind('body')" :label="t('core.incidents.fields.comment_body')" :rows="3" stacked />
            <SelectField v-if="isStaff" v-bind="comment.form.bind('visibility')" :label="t('core.incidents.fields.comment_visibility')" :options="commentVisibilityOptions" />
            <Button prominence="primary" :processing="comment.form.submitting.value" @click="comment.run()">{{ t("core.incidents.actions.add_comment") }}</Button>
          </div>
        </Panel>
      </div>

      <!-- Sidebar -->
      <div class="flex min-w-0 flex-col gap-4">
        <Panel v-if="incident" :title="t('core.incidents.details.summary')">
          <div class="flex flex-col gap-3 text-xs">
            <KeyValue :label="t('core.incidents.fields.source')" :value="named(SOURCE_LABELS, incident.source)" />
            <KeyValue :label="t('core.incidents.fields.first_seen_at')" :value="format.dateTime(incident.first_seen_at)" />
            <KeyValue :label="t('core.incidents.fields.last_seen_at')" :value="format.dateTime(incident.last_seen_at)" />
            <KeyValue :label="t('core.incidents.fields.occurrence_count')" :value="incident.occurrence_count" />
            <div v-if="incident.reporter">
              <h6 class="mb-1 font-semibold uppercase text-content-muted">{{ t("core.incidents.fields.reporter") }}</h6>
              <Person :person="incident.reporter" />
            </div>
            <div v-if="incident.assignee">
              <h6 class="mb-1 font-semibold uppercase text-content-muted">{{ t("core.incidents.fields.assignee") }}</h6>
              <Person :person="incident.assignee" />
            </div>
            <div v-if="incident.external_ticket_url">
              <h6 class="mb-1 font-semibold uppercase text-content-muted">{{ t("core.incidents.fields.external_ticket") }}</h6>
              <a :href="incident.external_ticket_url" target="_blank" rel="noopener" class="text-content-link hover:underline">{{ incident.external_ticket_id || incident.external_ticket_url }}</a>
            </div>
          </div>
        </Panel>

        <FormView v-if="canUpdate" :form="management" @submit="saveManagement">
          <FormGroup :header="t('core.incidents.details.management')" label-width="7rem" data-test="incident-management">
            <SelectField v-bind="management.bind('status')" :label="t('core.incidents.fields.status')" :options="statusOptions" />
            <SelectField v-bind="management.bind('severity')" :label="t('core.incidents.fields.severity')" :options="severityOptions" />
            <SelectField v-bind="management.bind('visibility')" :label="t('core.incidents.fields.visibility')" :options="visibilityOptions" />
            <TextareaField v-bind="management.bind('resolution_summary')" :label="t('core.incidents.fields.resolution_summary')" :rows="3" :max-length="2000" stacked />
            <SelectField v-bind="management.bind('external_ticket_provider')" :label="t('core.incidents.fields.external_ticket_provider')" :options="ticketProviderOptions" />
            <TextField v-bind="management.bind('external_ticket_id')" :label="t('core.incidents.fields.external_ticket_id')" :max-length="100" />
            <TextField v-bind="management.bind('external_ticket_url')" :label="t('core.incidents.fields.external_ticket_url')" :max-length="500" />
          </FormGroup>
        </FormView>
      </div>
    </div>
  </ResourcePage>
</template>
