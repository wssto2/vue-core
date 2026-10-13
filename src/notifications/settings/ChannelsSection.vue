<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { FormGroup, FormRow, SwitchField } from "../../form";
import { Icon } from "../../icon";
import SectionIntro from "../../identity/shared/SectionIntro.vue";
import type { Preferences } from "../../modules/notification/entities";
import { useCategoryText } from "./categoryText";
import type { Channel } from "./state";

/**
 * "Notify me about": a group per category the application declared, with a switch per channel that is available (e-mail, push),
 * saved as it is switched (one on its way ignores another touch). A setting someone else enforces is a row that reads, with
 * who decides. In-app is not a switch: the line under the title says it is always on. Without e-mail and push there is a sentence and no switches.
 */
const props = defineProps<{ preferences: Preferences }>();
const emit = defineEmits<{ change: [category: string, channel: Channel, enabled: boolean] }>();

const { t } = useI18n();
const textOf = useCategoryText();

const channels = computed<Channel[]>(() => [...(props.preferences.email_available ? (["email"] as const) : []), ...(props.preferences.push_available ? (["push"] as const) : [])]);
</script>

<template>
  <section class="flex min-w-0 flex-col gap-group-gap" data-notification-channels>
    <SectionIntro :title="t('core.notifications.settings.channels.title')" :description="t('core.notifications.settings.email.in_app')" data-in-app />
    <FormGroup v-if="channels.length === 0" data-email-unavailable>
      <FormRow layout="setting" :label="t('core.notifications.settings.email.unavailable')" />
    </FormGroup>
    <FormGroup v-for="category in channels.length === 0 ? [] : props.preferences.categories" :key="category.category" :header="textOf(category.category).label" :footer="textOf(category.category).description" :data-category="category.category">
      <template v-for="channel in channels" :key="channel">
        <!-- A setting someone else enforces is a row that reads: what it is, and who decides. -->
        <FormRow v-if="category[channel].source === 'enforced'" :data-channel="channel" layout="setting" :label="t(`core.notifications.settings.channels.${channel}`)" :sub="t('core.notifications.settings.email.locked')">
          <span class="flex items-center gap-1.5 text-body text-content-muted"><Icon name="lockLine" :size="14" />{{ category[channel].enabled ? t("core.form.yes") : t("core.form.no") }}</span>
        </FormRow>
        <div v-else :data-channel="channel">
          <SwitchField :model-value="category[channel].enabled" :label="t(`core.notifications.settings.channels.${channel}`)" @update:model-value="emit('change', category.category, channel, $event)" />
        </div>
      </template>
    </FormGroup>
  </section>
</template>
