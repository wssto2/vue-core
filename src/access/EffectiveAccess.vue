<script setup lang="ts">
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import { Button } from "../button";
import { FormGroup, FormRow } from "../form";
import type { EffectivePermission } from "../modules/access/entities";
import { useCompactPresentation } from "../overlay";
import { Badge } from "../state";
import { useAccessContext } from "./context";
import { groupEffective, type EffectiveScreen } from "./effective";
import { useAccessLabels } from "./labels";

/**
 * *What {name} can do*: the effective permissions by module and screen, worked out from the roles; nothing here edits. Each screen says
 * which actions are held, which roles give them and how wide (whose records, which places); *Why* opens the reason for every action.
 * A permission switched off for the tenant is marked. On a phone the modules beyond the first three sit behind *All n modules*.
 */
const props = defineProps<{ effective: readonly EffectivePermission[]; name: string }>();

const { t } = useI18n();
const { catalogue } = useAccessContext();
const labels = useAccessLabels();
const compact = useCompactPresentation();

const groups = computed(() => groupEffective(catalogue, props.effective));
const showAll = ref(false);
const shown = computed(() => (compact.value && !showAll.value ? groups.value.slice(0, 3) : groups.value));
const open = ref<Record<string, boolean>>({});

const actionsText = (screen: EffectiveScreen) => screen.actions.map((action) => labels.permissionLabel(action.permission)).join(" · ");
const sourcesText = (screen: EffectiveScreen) =>
  screen.sources.map((source) => {
    const role = labels.roleName({ key: source.roleKey, name: source.roleName });
    return screen.ownable ? `${role} (${labels.qualifierNoun(source.qualifier).toLowerCase()})` : role;
  }).join(", ");
const reach = (screen: EffectiveScreen) => [screen.qualifier ? labels.qualifierNoun(screen.qualifier) : "", screen.scopes.map((scope) => labels.scopeLabel(scope)).join(", ")].filter(Boolean).join(" · ");
</script>

<template>
  <section class="flex min-w-0 flex-col gap-group-gap" data-test="effective-access">
    <h2 class="px-row-inset text-title3 font-semibold text-content-strong">{{ t("core.access.effective.title", { name: props.name }) }}</h2>

    <FormGroup v-if="groups.length === 0" :footer="t('core.access.effective.footer')">
      <FormRow layout="setting" :label="t('core.access.effective.empty')" />
    </FormGroup>

    <template v-else>
      <FormGroup v-for="group in shown" :key="group.key" :header="labels.groupLabel(group.key)" :footer="group === shown[shown.length - 1] ? t('core.access.effective.footer') : undefined">
        <FormRow v-for="screen in group.screens" :key="screen.key" layout="setting" :label="labels.screenLabel(screen.key)">
          <template #sub>
            <span class="block" data-test="effective-actions">{{ actionsText(screen) }}</span>
            <span class="block" data-test="effective-sources">{{ t("core.access.effective.from_roles", { roles: sourcesText(screen) }) }}</span>

            <ul v-if="open[screen.key]" class="mt-2 flex flex-col gap-1.5 border-l border-border-separator pl-3" data-test="effective-why">
              <li v-for="action in screen.actions" :key="action.permission" :data-permission="action.permission">
                <span class="text-content">{{ labels.permissionLabel(action.permission) }}</span>
                <span v-if="action.unavailable" class="ml-2 text-content-muted">{{ t("core.access.effective.unavailable") }}</span>
                <span v-for="grant in action.grants" :key="`${grant.binding_id}-${grant.scope.level}-${grant.scope.id ?? 0}`" class="block text-content-muted">
                  {{ t("core.access.effective.why_row", {
                    role: labels.roleName({ key: grant.role_key, name: grant.role_name }),
                    whose: labels.qualifierNoun(screen.ownable ? grant.qualifier : "all"),
                    scope: labels.scopeLabel(grant.scope),
                  }) }}
                </span>
              </li>
            </ul>
          </template>

          <span v-if="screen.allUnavailable" class="contents" data-test="effective-unavailable"><Badge tone="warning">{{ t("core.access.effective.unavailable") }}</Badge></span>
          <span class="text-right text-footnote text-content-muted" data-test="effective-reach">{{ reach(screen) }}</span>
          <span class="contents" :data-test="`why-${screen.key}`">
            <Button prominence="secondary" size="sm" @click="open[screen.key] = !open[screen.key]">{{ open[screen.key] ? t("core.access.effective.hide_why") : t("core.access.effective.show_why") }}</Button>
          </span>
        </FormRow>
      </FormGroup>

      <span v-if="compact && groups.length > 3" class="contents" data-test="effective-show-all">
        <Button prominence="secondary" class="self-center" @click="showAll = !showAll">
          {{ showAll ? t("core.access.effective.fewer_modules") : t("core.access.effective.all_modules", { count: groups.length }) }}
        </Button>
      </span>
    </template>
  </section>
</template>
