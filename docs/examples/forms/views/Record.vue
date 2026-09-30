<script setup lang="ts">
import { FormView, GroupSheet, provideRecordGroups, RecordGroupScope, useGroupSheet, useResourceForm } from "@wssto2/vue-core/form";
import { RecordHeader } from "@wssto2/vue-core/page";
import { ResourcePage, useRouteResource } from "@wssto2/vue-core/resource";
import { useI18n } from "vue-i18n";
import AssignDialog from "../components/AssignDialog.vue";
import TicketSections from "../components/TicketSections.vue";
import { TICKET, useTicketFormsApi } from "../context";
import { camel, emptyTicket, ticketBody, ticketSchema, ticketValues } from "../form";

const { t } = useI18n();
const api = useTicketFormsApi();

// A record edited where it reads (D22): the page reads every group, each group has Edit, each sheet saves. The page has no Save.
const ticket = useRouteResource({ key: TICKET, param: "ticketID", load: (id, { signal }) => api.get(id, signal) });
const form = useResourceForm({
  source: ticket, // hydrates from the page's record: no second request
  defaults: emptyTicket,
  validator: ticketSchema,
  toValues: ticketValues, // DTO to draft, explicit
  serverField: camel,
  save: (payload, current, { idempotencyKey }) => api.update(current.id, ticketBody(payload, current), idempotencyKey), // the record's full update
});

const sheets = {} as Record<"details" | "contact", { present: () => void }>;
const groups = provideRecordGroups<"details" | "contact">({ edit: (group) => sheets[group].present });

// Details saves the record's full update (the default); its endpoint documents 409 as "your copy is stale", so a stale save is rebased.
const details = useGroupSheet({
  form,
  group: "details",
  fields: ["subject", "priority", "dueOn"],
  groupOf: groups.groupOf,
  rebase: { reload: () => ticket.reload(), message: () => t("forms.stale") },
});
// Contact has an endpoint of its own: it receives exactly these fields. A 409 there is shown as the conflict it is.
const contact = useGroupSheet({
  form,
  group: "contact",
  fields: ["email", "phone"],
  groupOf: groups.groupOf,
  save: (changes) => api.saveContact(ticket.id.value ?? 0, changes),
  onSaved: () => ticket.reload(),
});
Object.assign(sheets, { details, contact });

const groupLabel = (group: string) => t(`forms.${group}`);
</script>

<template>
  <ResourcePage :resource="ticket" :title="ticket.data.value?.subject ?? t('forms.ticket')" :back="{ label: t('forms.tickets'), to: '/' }">
    <template #header="{ record }"><RecordHeader :title="record.subject" /></template>
    <template #default>
      <FormView :editable="false"><TicketSections :form="form" /></FormView>
      <AssignDialog />
    </template>
  </ResourcePage>

  <GroupSheet :sheet="details" :title="t('forms.details')" :editable="true" :group-label="groupLabel">
    <RecordGroupScope only="details" :editable="true"><TicketSections :form="form" /></RecordGroupScope>
  </GroupSheet>
  <GroupSheet :sheet="contact" :title="t('forms.contact')" :editable="true" :group-label="groupLabel">
    <RecordGroupScope only="contact" :editable="true"><TicketSections :form="form" /></RecordGroupScope>
  </GroupSheet>
</template>
