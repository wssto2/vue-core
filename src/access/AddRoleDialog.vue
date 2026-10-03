<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { CommandDialog, FormGroup, FormRow, OptionList, SegmentedField, SelectField, useCommand, type FormValidator } from "../form";
import type { Binding, Role, ScopeOptions, SubjectRef } from "../modules/access/entities";
import { toast } from "../overlay";
import { useAccessApi } from "./api";
import { useAccessContext } from "./context";
import { useAccessLabels } from "./labels";
import { useRefusalMessage } from "./refusals";
import { defaultLevel, placesAt, scopeLevels, type ScopeLevel } from "./scopes";

/**
 * *Add role*: where first (a level of the hierarchy and the place, from what the server says this person may be given and the actor may give;
 * an application with one level asks nothing here), then the role, from the ones the actor may give there (delegation already applied). What the
 * chosen role reaches is the role's own and is only shown: it changes in Roles, not here.
 */
const props = defineProps<{ subject: SubjectRef; subjectLabel: string }>();
const emit = defineEmits<{ added: [binding: Binding] }>();

const { t } = useI18n();
const labels = useAccessLabels();
const api = useAccessApi();
const { catalogue, rootLevel, scopes: loadScopes } = useAccessContext();

interface Draft {
  level: string | null;
  /** The id of the last place of the level's chain; null for the root. */
  place: number | null;
  role: string | null;
}
const validator: FormValidator<{ level: string; place: number | null; role: string }> = {
  safeParse(input) {
    const draft = input as Draft;
    const issues = [
      ...(draft.level === null || (draft.level !== rootLevel && draft.place === null) ? [{ path: ["level"], message: t("core.access.add.choose_place") }] : []),
      ...(draft.role === null ? [{ path: ["role"], message: t("core.access.add.choose_role") }] : []),
    ];
    return issues.length === 0 ? { success: true, data: { level: draft.level as string, place: draft.place, role: draft.role as string } } : { success: false, error: { issues } };
  },
};

const add = useCommand<Draft, { level: string; place: number | null; role: string }, Binding>({
  defaults: () => ({ level: null, place: null, role: null }),
  validator,
  failureMessage: useRefusalMessage(),
  run: (input) => api.bind(props.subject, { role_ref: input.role, level: input.level, scope_id: input.place }),
  done: (binding) => {
    toast.success(t("core.access.added"));
    emit("added", binding);
  },
});
const values = add.form.values;

const options = ref<ScopeOptions | null>(null);
const optionsFailed = ref(false);
const chosen = ref<(number | null)[]>([]);
const roles = ref<readonly Role[]>([]);
const rolesLoading = ref(false);
const rolesFailed = ref(false);

const levels = computed(() => (options.value ? scopeLevels(options.value, rootLevel) : []));
const level = computed<ScopeLevel | null>(() => levels.value.find((entry) => entry.level === values.level) ?? null);
/** One level only (the root): there is nothing to ask. */
const askLevel = computed(() => levels.value.length > 1);
const steps = computed(() => {
  const found = options.value;
  const current = level.value;
  return found && current ? current.chain.map((name, index) => ({ name, places: placesAt(found, current, index, chosen.value) })) : [];
});
const placeName = computed(() => {
  const depth = level.value?.chain.length ?? 0;
  const id = depth ? chosen.value[depth - 1] : null;
  return options.value?.places.find((place) => place.level === level.value?.level && place.id === id)?.name ?? null;
});
const scopeReady = computed(() => level.value !== null && level.value.chain.every((_, index) => chosen.value[index] != null));

function chooseLevel(name: string | null) {
  values.level = name;
  chosen.value = [];
  values.place = null;
}

function choosePlace(index: number, id: number | null) {
  const next = chosen.value.slice(0, index);
  next[index] = id;
  chosen.value = next;
}

// A step with a single place is chosen for the person; the place is complete when every step of the chain has one.
watch([() => values.level, chosen, options], () => {
  const found = options.value;
  const current = level.value;
  if (!found || !current) return;
  for (let index = 0; index < current.chain.length; index++) {
    if (chosen.value[index] != null) continue;
    const only = placesAt(found, current, index, chosen.value);
    if (only.length === 1 && only[0]) choosePlace(index, only[0].id);
    break;
  }
  values.place = current.chain.length === 0 ? null : (chosen.value[current.chain.length - 1] ?? null);
}, { deep: true });

async function loadRoles() {
  values.role = null;
  roles.value = [];
  rolesFailed.value = false;
  if (!level.value || !scopeReady.value) return;
  rolesLoading.value = true;
  const asked = `${values.level}:${values.place}`;
  try {
    const found = await api.bindable(level.value.level, values.place);
    if (asked === `${values.level}:${values.place}`) roles.value = found;
  } catch {
    if (asked === `${values.level}:${values.place}`) rolesFailed.value = true;
  } finally {
    rolesLoading.value = false;
  }
}
watch([() => values.level, () => values.place, scopeReady], () => void loadRoles());

const roleOptions = computed(() => roles.value.map((candidate) => ({ value: candidate.ref, label: labels.roleName(candidate), description: labels.roleKind(candidate) })));
const role = computed(() => roles.value.find((candidate) => candidate.ref === values.role) ?? null);
/** The whose of each record type the chosen role reaches: read off its grants (the view's, else any). */
const whoseRows = computed(() => {
  const held = new Map<string, string>();
  for (const grant of role.value?.grants ?? []) {
    const ownable = catalogue[grant.permission]?.ownable;
    if (ownable && (!held.has(ownable) || grant.permission.endsWith(":view"))) held.set(ownable, grant.qualifier);
  }
  return [...held].map(([ownable, qualifier]) => ({ ownable, qualifier }));
});
const scopeText = computed(() => labels.scopeLabel({ level: values.level ?? rootLevel, name: placeName.value }));

async function present() {
  options.value = null;
  optionsFailed.value = false;
  chosen.value = [];
  roles.value = [];
  add.present();
  try {
    options.value = loadScopes ? await loadScopes(props.subject, new AbortController().signal) : await api.scopes(props.subject);
  } catch {
    optionsFailed.value = true;
    return;
  }
  const start = defaultLevel(levels.value);
  if (start) chooseLevel(start.level);
}
defineExpose({ present });
</script>

<template>
  <CommandDialog :command="add" :title="t('core.access.add_role')" :subtitle="props.subjectLabel" size="lg" :confirm-label="t('core.access.add.confirm')">
    <div class="flex min-w-0 flex-col gap-group-gap" data-test="add-role-sheet">
      <p v-if="optionsFailed" class="px-row-inset text-body text-content-destructive" role="alert" data-test="scopes-failed">{{ t("core.access.add.scopes_failed") }}</p>
      <p v-else-if="options && levels.length === 0" class="px-row-inset text-body text-content-muted" data-test="no-places">{{ t("core.access.add.no_places") }}</p>

      <!-- Where: asked only when the hierarchy has levels below the root -->
      <FormGroup v-if="askLevel" :header="t('core.access.add.scope_header')">
        <SegmentedField :model-value="values.level" :label="t('core.access.add.scope_level')" :options="levels.map((entry) => ({ value: entry.level, label: labels.levelLabel(entry.level) }))"
          @update:model-value="chooseLevel($event)" />
        <SelectField v-for="(step, index) in steps" :key="step.name" :model-value="chosen[index] ?? null" :label="labels.levelLabel(step.name)"
          :options="step.places.map((place) => ({ value: place.id, label: place.name }))" @update:model-value="choosePlace(index, $event)" />
      </FormGroup>

      <template v-if="scopeReady">
        <p v-if="rolesLoading" class="px-row-inset text-body text-content-muted" data-test="roles-loading">{{ t("core.access.add.roles_loading") }}</p>
        <p v-else-if="rolesFailed" class="px-row-inset text-body text-content-destructive" role="alert" data-test="roles-failed">{{ t("core.access.add.roles_failed") }}</p>
        <p v-else-if="roles.length === 0" class="px-row-inset text-body text-content-muted" data-test="roles-none">{{ t("core.access.add.no_roles") }}</p>

        <div v-else data-test="bindable-roles">
          <p class="px-row-inset pb-1.5 text-footnote uppercase tracking-wide text-content-muted">{{ t("core.access.add.role") }}</p>
          <OptionList :options="roleOptions" :model-value="values.role" @select="values.role = $event" />
        </div>
      </template>

      <div v-if="role" data-test="chosen-role">
        <FormGroup :header="t('core.access.add.role_gives')" :footer="t('core.access.add.role_gives_footer')">
          <FormRow layout="setting" :label="labels.roleName(role)" :sub="role.description" />
          <FormRow v-for="row in whoseRows" :key="row.ownable" layout="setting" :label="labels.ownableLabel(row.ownable)" :value="`${labels.qualifierNoun(row.qualifier)} · ${scopeText}`" />
        </FormGroup>
      </div>
    </div>
  </CommandDialog>
</template>
