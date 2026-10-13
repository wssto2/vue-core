<script setup lang="ts">
import { watch } from "vue";
import { useI18n } from "vue-i18n";
import { FormView, GroupSheet, provideRecordGroups, RecordGroupScope, useForm, useGroupSheet, type FormValidator } from "../../form";
import type { ProfileResponse } from "../../modules/identity/entities";
import { identityRoutes } from "../../modules/identity/routes";
import type { UpdateProfileInput } from "../../modules/identity/schemas";
import { toast } from "../../overlay";
import { usePlatform } from "../../platform";
import { useServerMessages } from "../fieldMessages";
import DetailsFields from "./DetailsFields.vue";

/**
 * The person's own name and phone, read on the page and changed in a sheet (one save, the page has none). The username is
 * shown with its note, never edited here (an administrator changes it).
 */
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

const sheets = {} as Record<"details", { present: () => void }>;
const groups = provideRecordGroups<"details">({ edit: (group) => sheets[group].present });
let saved: ProfileResponse | null = null;
const details = useGroupSheet({
  form,
  group: "details",
  fields: ["name", "phone"],
  groupOf: groups.groupOf,
  save: async (changes) => {
    saved = (await http.request(identityRoutes.profileUpdate, { name: changes.name, phone: changes.phone.trim() === "" ? undefined : changes.phone })).data;
  },
  onSaved: () => {
    toast.success(t("core.profile.details.saved"));
    if (saved) emit("updated", saved);
  },
});
sheets.details = details;
</script>

<template>
  <FormView :editable="false" data-profile-details><DetailsFields :bind="form.bind" :login="props.profile.login" /></FormView>

  <GroupSheet :sheet="details" :title="t('core.profile.details.title')" :editable="true" :group-label="() => t('core.profile.details.title')">
    <RecordGroupScope only="details" :editable="true"><DetailsFields :bind="form.bind" :login="props.profile.login" /></RecordGroupScope>
  </GroupSheet>
</template>
