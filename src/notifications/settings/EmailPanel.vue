<script setup lang="ts">
import { useI18n } from "vue-i18n";
import { Panel } from "../../content";
import { FormGroup, FormRow, SwitchField } from "../../form";
import { Icon } from "../../icon";
import type { Preferences } from "../../modules/notification/entities";
import { useCategoryText } from "./categoryText";

/**
 * "E-mail me about": one switch per category the application declared, saved as it is switched (one on its way ignores another
 * touch). A setting someone else enforces is a row that reads, with who decides; without e-mail there is a sentence and no switches. In-app is not a switch: it is always on.
 */
const props = defineProps<{ preferences: Preferences }>();
const emit = defineEmits<{ change: [category: string, enabled: boolean] }>();

const { t } = useI18n();
const textOf = useCategoryText();
</script>

<template>
  <Panel :title="t('core.notifications.settings.email.title')" icon="notification3Line" data-notification-email>
    <p v-if="!props.preferences.email_available" class="text-subheadline text-content-muted" data-email-unavailable>{{ t("core.notifications.settings.email.unavailable") }}</p>
    <FormGroup v-else :footer="t('core.notifications.settings.email.in_app')" data-in-app>
      <template v-for="category in props.preferences.categories" :key="category.category">
        <!-- A setting someone else enforces is a row that reads: what it is, and who decides. -->
        <FormRow v-if="category.email.source === 'enforced'" :data-category="category.category" layout="setting" :label="textOf(category.category).label" :sub="t('core.notifications.settings.email.locked')">
          <span class="flex items-center gap-1.5 text-body text-content-muted"><Icon name="lockLine" :size="14" />{{ category.email.enabled ? t("core.form.yes") : t("core.form.no") }}</span>
        </FormRow>
        <div v-else :data-category="category.category">
          <SwitchField :model-value="category.email.enabled" :label="textOf(category.category).label" :hint="textOf(category.category).description" @update:model-value="emit('change', category.category, $event)" />
        </div>
      </template>
    </FormGroup>
    <p v-if="!props.preferences.email_available" class="mt-3 text-footnote text-content-muted" data-in-app>{{ t("core.notifications.settings.email.in_app") }}</p>
  </Panel>
</template>
