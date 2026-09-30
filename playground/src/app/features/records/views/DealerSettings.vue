<script setup lang="ts">
import { useI18n } from "vue-i18n";
import { SectionPanel } from "@wssto2/vue-core/page";
import { useRouteResourceContext } from "@wssto2/vue-core/resource";
import { DEALER_RESOURCE } from "../context";

// A long section of several panels: each `SectionPanel` is listed under the section in the source list
// (wide) or in the floating jumper (compact), with the one in view marked.
const { t } = useI18n();
const dealer = useRouteResourceContext(DEALER_RESOURCE);
</script>

<template>
  <div v-if="dealer.data.value" class="flex flex-col gap-section-gap">
    <SectionPanel v-for="(title, position) in ['Identification', 'Contact', 'Integrations', 'Notifications']" :key="title" :title="title" :number="`0${position + 1}`" collapsible>
      <p class="min-h-40 text-content-muted">{{ t("records.sections.settings") }}: {{ title }} ({{ dealer.data.value.name }})</p>
    </SectionPanel>
  </div>
</template>
