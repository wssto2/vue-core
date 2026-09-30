<script setup lang="ts">
import { CommandDialog, FormGroup, FormView, GroupSheet, provideRecordGroups, RecordGroupScope, SegmentedField, TextareaField, useCommand, useGroupSheet } from "@wssto2/vue-core/form";
import { toast } from "@wssto2/vue-core/overlay";
import { RecordHeader, type PageAction } from "@wssto2/vue-core/page";
import { ResourcePage, useRouteResource } from "@wssto2/vue-core/resource";
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { api, type Account } from "../api";
import AccountSections from "../components/AccountSections.vue";
import { ACCOUNT_RESOURCE } from "../context";
import { GROUPS, useAccountForm, type AccountGroup } from "../form";
import { formsRoutes } from "../routes";

// A record edited where it reads (D22): the page reads every group; each group that can change has Edit, which opens a sheet with that
// group alone. No Save on the page: each sheet saves. Three of the four groups save the record's full update; Contact has an endpoint of
// its own; Identity rebases a stale save (its endpoint documents 409 as "your copy is stale"), the others show the conflict as it is.
const { t } = useI18n();
const account = useRouteResource({ key: ACCOUNT_RESOURCE, param: "accountID", load: (id, { signal }) => api.account(id, signal) });
const form = useAccountForm(account, { required: t("forms.required"), email: t("forms.invalidEmail") });

const sheets = {} as Record<AccountGroup, { present: () => void }>;
const archived = computed(() => account.data.value?.status === "archived");
const groups = provideRecordGroups<AccountGroup>({ edit: (group) => (archived.value ? null : sheets[group].present) });

const identity = useGroupSheet({ form, group: "identity", fields: GROUPS.identity, groupOf: groups.groupOf, rebase: { reload: () => account.reload(), message: () => t("forms.stale") } });
const contact = useGroupSheet({
  form,
  group: "contact",
  fields: GROUPS.contact,
  groupOf: groups.groupOf,
  // Its own endpoint: it receives the three contact fields and nothing else, and answers with no record, so the page reads it again.
  save: (changes) => api.updateContact(account.id.value ?? 0, changes),
  onSaved: () => account.reload(),
});
const address = useGroupSheet({ form, group: "address", fields: GROUPS.address, groupOf: groups.groupOf });
const notes = useGroupSheet({ form, group: "notes", fields: GROUPS.notes, groupOf: groups.groupOf });
Object.assign(sheets, { identity, contact, address, notes });
const allSheets = { identity, contact, address, notes } as const;

// A command: change the status, with a note. One purpose-specific endpoint, its own confirmation, no autosave.
const status = useCommand({
  defaults: () => ({ status: "paused" as Account["status"], note: "" }),
  run: (input) => api.changeStatus(account.id.value ?? 0, input),
  done: (saved) => account.update(saved),
});
const statuses = [
  { value: "active", label: t("forms.status.active") },
  { value: "paused", label: t("forms.status.paused") },
  { value: "archived", label: t("forms.status.archived") },
] as const;

const actions = computed<PageAction[]>(() => [
  { id: "status", label: t("forms.changeStatus"), placement: "secondary", onClick: () => status.present({ status: account.data.value?.status === "active" ? "paused" : "active" }) },
  {
    id: "colleague",
    label: t("forms.colleague"),
    placement: "overflow",
    onClick: () => void api.touch(account.id.value ?? 0).then(() => toast.info(t("forms.colleagueDone"))),
  },
]);

const groupLabel = (group: string) => t(`forms.groups.${group}`);
const fieldLabel = (field: string) => t(`forms.fields.${field}`, field);
</script>

<template>
  <ResourcePage :resource="account" :title="account.data.value?.name ?? t('forms.account')" :back="{ label: t('forms.accounts'), to: formsRoutes.index }" :actions="actions">
    <template #header="{ record }">
      <RecordHeader :title="record.name" :subtitle="`${record.city} · ${t(`forms.status.${record.status}`)}`" />
    </template>
    <template #default>
      <FormView :editable="false">
        <AccountSections :form="form" />
      </FormView>
    </template>
  </ResourcePage>

  <GroupSheet v-for="(sheet, group) in allSheets" :key="group" :sheet="sheet" :title="groupLabel(group)" :editable="true" :group-label="groupLabel" :field-label="fieldLabel"
    @saved="toast.success(t('forms.saved'))">
    <RecordGroupScope :only="group" :editable="true"><AccountSections :form="form" /></RecordGroupScope>
  </GroupSheet>

  <CommandDialog :command="status" :title="t('forms.changeStatus')" :confirm-label="t('forms.changeStatus')" :message="t('forms.statusMessage')" :field-label="fieldLabel">
    <FormGroup>
      <SegmentedField v-bind="status.form.bind('status')" :label="t('forms.fields.status')" :options="statuses" />
      <TextareaField v-bind="status.form.bind('note')" :label="t('forms.fields.note')" stacked />
    </FormGroup>
  </CommandDialog>
</template>
