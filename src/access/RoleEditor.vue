<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { FormGroup, FormView, TextareaField, TextField, useForm, useSaveChrome, type FormValidator } from "../form";
import type { Role } from "../modules/access/entities";
import { toast } from "../overlay";
import { Badge, Banner } from "../state";
import { useAccessApi } from "./api";
import { completeRequired, type Grants } from "./catalogue";
import { accessPermissions, useAccessContext } from "./context";
import { useAccessLabels } from "./labels";
import PermissionTree from "./PermissionTree.vue";
import { useRefusalMessage } from "./refusals";
import { usePlatform } from "../platform";

/**
 * A role, read or edited: its name and description, then the permission tree. A custom role edits with Save and Cancel in the
 * page chrome; a predefined or computed role only reads (*Copy* is its way to a custom one). `source` prefills a new role from
 * another (Copy): it is still created as a new role.
 */
const props = defineProps<{
  /** The saved role; null while creating a new one. */
  role: Role | null;
  /** The role a new one is copied from. */
  source?: Role | null;
}>();

const emit = defineEmits<{ saved: [role: Role] }>();

const { t } = useI18n();
const labels = useAccessLabels();
const { catalogue } = useAccessContext();
const api = useAccessApi();
const { access } = usePlatform();

interface Draft {
  name: string;
  description: string;
  grants: Grants;
}

const draftOf = (role: Role | null, source: Role | null | undefined): Draft => {
  const from = role ?? source ?? null;
  return {
    name: role ? role.name : source ? t("core.access.copy_name", { name: labels.roleName(source) }) : "",
    description: from?.description ?? "",
    grants: Object.fromEntries((from?.grants ?? []).map((grant) => [grant.permission, grant.qualifier as Grants[string]])),
  };
};

const validator: FormValidator<Draft> = {
  safeParse(input) {
    const draft = input as Draft;
    const issues = [
      ...(draft.name.trim() === "" ? [{ path: ["name"], message: t("core.access.name_required") }] : []),
      ...(draft.name.length > 100 ? [{ path: ["name"], message: t("core.access.too_long") }] : []),
      ...(draft.description.length > 255 ? [{ path: ["description"], message: t("core.access.too_long") }] : []),
    ];
    return issues.length === 0 ? { success: true, data: draft } : { success: false, error: { issues } };
  },
};

const form = useForm<Draft>({
  defaults: () => draftOf(props.role, props.source),
  validator,
  failureMessage: useRefusalMessage(),
});

// What the loaded role lacked of what its own permissions need, switched on: the server would refuse the role as it is.
// The baseline stays as loaded, so the additions show as unsaved changes.
const completed = ref<string[]>([]);
function load() {
  form.hydrate(draftOf(props.role, props.source));
  completed.value = completeRequired(catalogue, form.values.grants);
}
load();
watch(() => [props.role, props.source] as const, load);

const readonly = computed(() => (props.role !== null && (props.role.predefined || props.role.computed)) || !access.can(accessPermissions.manageRoles));

const completedNote = computed(() =>
  completed.value.length === 0 || readonly.value ? "" : t("core.access.completed", { names: completed.value.map((id) => labels.permissionLabel(id)).join(", ") }),
);

async function save() {
  if (readonly.value) return;
  const result = await form.submit(
    (draft) => {
      const body = {
        name: draft.name.trim(),
        description: draft.description,
        grants: Object.entries(draft.grants).map(([permission, qualifier]) => ({ permission, qualifier })),
        // Constraints are the application's own business: kept as the role has them.
        attrs: (props.role ?? props.source)?.attrs ?? [],
      };
      return props.role ? api.update({ ref: props.role.ref, ...body }) : api.create(body);
    },
    { hydrateFrom: (saved) => draftOf(saved, null) },
  );
  if (result.status === "saved" || result.status === "saved-refresh-failed") {
    toast.success(t("core.access.saved"));
    emit("saved", result.value);
  }
}

useSaveChrome({ form, label: () => t("core.access.save"), allowed: () => !readonly.value, disabledWhileClean: () => props.role !== null, save: () => void save(), cancel: () => form.reset() });
const attrs = computed(() => (props.role ?? props.source)?.attrs ?? []);
defineExpose({ form, save });
</script>

<template>
  <FormView :form="form" @submit="save">
    <div class="flex min-w-0 flex-col gap-group-gap" data-test="role-editor">
      <Banner v-if="props.role?.computed" tone="info" data-test="role-computed-note">{{ t("core.access.notes.computed") }}</Banner>
      <Banner v-else-if="props.role?.predefined" tone="info" data-test="role-predefined-note">{{ t("core.access.notes.predefined") }}</Banner>
      <Banner v-if="completedNote" tone="warning" data-test="role-completed-note">{{ completedNote }}</Banner>

      <FormGroup :header="t('core.access.groups.role')" :editable="!readonly" label-width="12rem">
        <TextField v-bind="form.bind('name')" :label="t('core.access.fields.name')" :max-length="100" required />
        <TextareaField v-bind="form.bind('description')" :label="t('core.access.fields.description')" :rows="2" :max-length="255" />
        <!-- The application's own constraints on the role (go-core `attrs`): shown, not edited here. -->
        <div v-if="attrs.length" class="flex flex-wrap gap-1.5 px-row-inset py-2" data-test="role-attrs">
          <Badge v-for="attr in attrs" :key="attr.attribute" tone="neutral">{{ attr.attribute }}: {{ attr.values.join(", ") }}</Badge>
        </div>
      </FormGroup>

      <PermissionTree :grants="form.values.grants" :readonly="readonly" />
    </div>
  </FormView>
</template>
