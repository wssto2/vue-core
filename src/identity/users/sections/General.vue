<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { RouterLink } from "vue-router";
import { useFormat } from "../../../format";
import { FormGroup, FormView, SelectField, TextField, useResourceForm, useSaveChrome, type FormValidator } from "../../../form";
import { identityRoutes } from "../../../modules/identity/routes";
import type { UpdateUserInput } from "../../../modules/identity/schemas";
import { toast } from "../../../overlay";
import { usePlatform } from "../../../platform";
import { useRouteResourceContext } from "../../../resource";
import { useServerMessages } from "../../fieldMessages";
import ActionRow from "../../shared/ActionRow.vue";
import SectionIntro from "../../shared/SectionIntro.vue";
import { useLanguages } from "../languages";
import { PERSON, usePersonActions } from "../person";

/**
 * A person's details (username, name, language, e-mail, phone), edited in place and saved from the toolbar with the whole
 * record, with the rows that deactivate or activate them and the line saying when the account was made and last used.
 * Whoever may only look sees the details as values.
 */
const { t } = useI18n();
const { http } = usePlatform();
const format = useFormat();
const person = useRouteResourceContext(PERSON);
const actions = usePersonActions();
const languages = useLanguages();

type Details = Omit<UpdateUserInput, "id">;
const blank = (value: string | null) => value === null || value.trim() === "";

const validator: FormValidator<Details> = {
  safeParse(input) {
    const draft = input as { login: string; name: string; email: string; phone: string; locale: string | null };
    const issues = (["login", "name", "email", "locale"] as const).filter((field) => blank(draft[field])).map((field) => ({ path: [field], message: t("core.account.validation.required") }));
    return issues.length > 0 ? { success: false, error: { issues } } : { success: true, data: { ...draft, locale: draft.locale ?? "", phone: blank(draft.phone) ? undefined : draft.phone } };
  },
};

const form = useResourceForm({
  ...useServerMessages(),
  source: person,
  defaults: () => ({ login: "", name: "", email: "", phone: "", locale: null as string | null }),
  validator,
  toValues: (user) => ({ login: user.login, name: user.name, email: user.email, phone: user.phone, locale: user.locale }),
  save: async (payload, user) => (await http.request(identityRoutes.usersUpdate, { id: user.id, ...payload })).data,
});

async function save() {
  const result = await form.save();
  if (result.status === "saved" || result.status === "saved-refresh-failed") toast.success(t("core.users.general.saved"));
}

useSaveChrome({ form, allowed: () => actions.can.manage, ready: () => person.data.value !== null, save, cancel: () => form.reset() });

const record = computed(() => person.data.value);
</script>

<template>
  <div class="flex min-w-0 max-w-200 flex-col gap-group-gap" data-person-general>
    <SectionIntro :title="t('core.users.sections.general')" :description="t('core.users.intro.general')" />

    <FormView :form="form" :editable="actions.can.manage" @submit="save">
      <FormGroup :header="t('core.users.groups.person')" :footer="t('core.users.groups.person_footer')" label-width="14rem">
        <TextField v-bind="form.bind('name')" :label="t('core.users.fields.name')" required />
        <TextField v-bind="form.bind('login')" :label="t('core.users.fields.login')" required mono />
        <SelectField v-bind="form.bind('locale')" :label="t('core.users.fields.locale')" :options="languages" required />
      </FormGroup>
      <FormGroup :header="t('core.users.groups.contact')" label-width="14rem">
        <TextField v-bind="form.bind('email')" :label="t('core.users.fields.email')" type="email" required />
        <TextField v-bind="form.bind('phone')" :label="t('core.users.fields.phone')" type="tel" />
      </FormGroup>
    </FormView>

    <FormGroup v-if="actions.can.deactivate || actions.can.activate" data-person-actions>
      <ActionRow v-if="actions.can.deactivate" :label="t('core.users.actions.deactivate')" :sub="t('core.users.deactivate.row_sub')" tone="critical" data-deactivate-row @click="actions.deactivate()" />
      <ActionRow v-if="actions.can.activate" :label="t('core.users.actions.activate')" :sub="t('core.users.activate.row_sub')" data-activate-row @click="actions.activate()" />
    </FormGroup>

    <p v-if="record" class="flex flex-wrap items-center gap-x-1.5 px-row-inset text-footnote text-content-muted" data-person-audit>
      <span>{{ t("core.users.general.created", { when: format.dateTime(record.created_at) }) }}</span>
      <span aria-hidden="true">·</span>
      <span>{{ record.last_sign_in ? t("core.users.general.last_sign_in", { when: format.dateTime(record.last_sign_in) }) : t("core.users.general.never_signed_in") }}</span>
      <span aria-hidden="true">·</span>
      <RouterLink :to="{ name: 'users.record.changes', params: { id: record.id }, query: $route.query }" class="text-content-link">{{ t("core.users.general.all_changes") }}</RouterLink>
    </p>
  </div>
</template>
