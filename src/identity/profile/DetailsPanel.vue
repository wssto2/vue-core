<script setup lang="ts">
import { watch } from "vue";
import { useI18n } from "vue-i18n";
import { FormView, TextField, useForm, type FormValidator } from "../../form";
import type { ProfileResponse } from "../../modules/identity/entities";
import { identityRoutes } from "../../modules/identity/routes";
import type { UpdateProfileInput } from "../../modules/identity/schemas";
import { Panel } from "../../content";
import { toast } from "../../overlay";
import { usePlatform } from "../../platform";
import { useServerMessages } from "../fieldMessages";
import PanelActions from "./PanelActions.vue";

/** The person's own name and phone; the username is shown, never edited here (an administrator changes it). */
const props = defineProps<{ profile: ProfileResponse }>();
const emit = defineEmits<{ updated: [profile: ProfileResponse] }>();

const { t } = useI18n();
const { http } = usePlatform();

const validator: FormValidator<UpdateProfileInput> = {
  safeParse(input) {
    const { name, phone } = input as { name: string; phone: string };
    return name.trim() === ""
      ? { success: false, error: { issues: [{ path: ["name"], message: t("core.account.validation.required") }] } }
      : { success: true, data: { name, phone: phone.trim() === "" ? undefined : phone } };
  },
};

const form = useForm({ ...useServerMessages(), defaults: () => ({ name: "", phone: "" }), validator });
watch(() => props.profile, (profile) => form.hydrate({ name: profile.name, phone: profile.phone }), { immediate: true });

async function save() {
  const result = await form.submit(async (payload) => (await http.request(identityRoutes.profileUpdate, payload)).data);
  if (result.status === "saved") {
    toast.success(t("core.profile.details.saved"));
    emit("updated", result.value);
  }
}
</script>

<template>
  <Panel :title="t('core.profile.details.title')" icon="user3Line" data-profile-details>
    <FormView :form="form" @submit="save">
      <TextField v-bind="form.bind('name')" :label="t('core.users.fields.name')" required autocomplete="name" />
      <TextField v-bind="form.bind('phone')" :label="t('core.users.fields.phone')" type="tel" autocomplete="tel" />
      <TextField :model-value="props.profile.login" :label="t('core.users.fields.login')" :hint="t('core.profile.details.login_hint')" disabled mono data-profile-login />
    </FormView>
    <template #footer><PanelActions :label="t('core.profile.details.submit')" :processing="form.submitting.value" :dirty="form.dirty.value" @submit="save" @cancel="form.reset()" /></template>
  </Panel>
</template>
