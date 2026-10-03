<script setup lang="ts">
import { computed, ref, useTemplateRef } from "vue";
import { useI18n } from "vue-i18n";
import { Button } from "../button";
import { FormGroup, FormRow } from "../form";
import { useDescribeError } from "../i18n";
import type { Binding, SubjectRef } from "../modules/access/entities";
import { AlertDialog, toast } from "../overlay";
import { AccessGate } from "../platform";
import { AsyncSection, useLoad } from "../state";
import AddRoleDialog from "./AddRoleDialog.vue";
import { useAccessApi } from "./api";
import BindingRow from "./BindingRow.vue";
import { accessPermissions } from "./context";
import EffectiveAccess from "./EffectiveAccess.vue";
import { useAccessLabels } from "./labels";

/**
 * A person's access: their roles, each with where it applies, *Add role* and removal (both offered only when the server says the actor may
 * manage them), then *What {name} can do*, the effective permissions with their reasons. Put it on the person's record, as a section
 * (`<PersonAccess :subject="{ kind: 'user', id }" :name="person.name" />`); `subjectLabel` says who a role is added for under the dialog's title.
 */
const props = defineProps<{
  subject: SubjectRef;
  /** The person's name, for "What Ana can do". */
  name: string;
  /** Under the add dialog's title; by default the name. */
  subjectLabel?: string;
}>();
const emit = defineEmits<{ loaded: [bindings: number] }>();

const { t } = useI18n();
const labels = useAccessLabels();
const describeError = useDescribeError();
const api = useAccessApi();

const access = useLoad(async ({ signal }) => {
  const result = await api.access(props.subject, { signal });
  emit("loaded", result.bindings.length);
  return result;
}, { watch: () => props.subject.id });

const addDialog = useTemplateRef<{ present: () => Promise<void> }>("addDialog");
const removeDialog = useTemplateRef<{ present: (binding: Binding) => void }>("removeDialog");

async function remove(binding: Binding) {
  await api.unbind(props.subject, binding.id);
  toast.success(t("core.access.removed"));
  await access.reload();
}
const removeFailed = (error: unknown) => toast.error(describeError(error, { fallback: t("core.access.remove_failed") }));
const removing = ref<Binding | null>(null);
const removeBody = computed(() => (removing.value ? t("core.access.remove_body", { name: props.name, role: labels.roleName(removing.value.role), scope: labels.scopeLabel(removing.value.scope) }) : ""));

defineExpose({ reload: access.reload });
</script>

<template>
  <div class="flex min-w-0 flex-col gap-group-gap" data-test="access-panel">
    <AsyncSection :state="access.state.value" :skeleton-rows="6" :is-empty="() => false" @retry="access.reload()">
      <template #default="{ value }">
        <FormGroup :header="t('core.access.person_roles')" :footer="t('core.access.roles_footer')">
          <FormRow v-if="value.bindings.length === 0" layout="setting" :label="t('core.access.no_roles_title')" :sub="t('core.access.no_roles_description')" />

          <BindingRow v-for="binding in value.bindings" :key="binding.id" :binding="binding">
            <template v-if="value.can_manage" #trailing>
              <AccessGate :permission="accessPermissions.manageBindings">
                <span class="contents" :data-test="`remove-binding-${binding.id}`">
                  <Button tone="critical" prominence="secondary" size="sm" @click="((removing = binding), removeDialog?.present(binding))">{{ t("core.access.remove") }}</Button>
                </span>
              </AccessGate>
            </template>
          </BindingRow>

          <AccessGate v-if="value.can_manage" :permission="accessPermissions.manageBindings">
            <FormRow layout="stacked">
              <span class="contents" data-test="add-role">
                <Button prominence="secondary" icon="addLine" @click="addDialog?.present()">{{ t("core.access.add_role") }}</Button>
              </span>
            </FormRow>
          </AccessGate>
        </FormGroup>

        <EffectiveAccess :effective="value.effective" :name="props.name" />
      </template>
    </AsyncSection>

    <AddRoleDialog ref="addDialog" :subject="props.subject" :subject-label="props.subjectLabel ?? props.name" @added="access.reload()" />
    <AlertDialog ref="removeDialog" tone="critical" :title="t('core.access.remove_title')" :message="removeBody" :confirm-label="t('core.access.remove')" :action="remove" @failed="removeFailed" />
  </div>
</template>
