<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { useRoute, useRouter } from "vue-router";
import type { Role } from "../modules/access/entities";
import { AdaptivePageShell } from "../page";
import { AsyncSection, useLoad } from "../state";
import { useAccessApi } from "./api";
import RoleEditor from "./RoleEditor.vue";
import { accessPages } from "./routes";

/** A new custom role. `?copy=<ref>` is *Copy*: the editor opens prefilled from that role and saves as a new one; copying a predefined role is the way to a role of one's own. */
const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const api = useAccessApi();

const copyRef = computed(() => (typeof route.query.copy === "string" ? route.query.copy : ""));
const source = useLoad<Role | null>(({ signal }) => (copyRef.value ? api.role(copyRef.value, { signal }) : Promise.resolve(null)), { watch: copyRef });

const onSaved = (saved: Role) => router.replace(accessPages.role({ ref: saved.ref }));
</script>

<template>
  <AdaptivePageShell :title="t('core.access.new_title')" :description="copyRef ? t('core.access.new_copy_description') : t('core.access.new_description')"
    :back="{ label: t('core.access.title'), to: accessPages.roles }" width="content">
    <AsyncSection :state="source.state.value" :skeleton-rows="8" :is-empty="() => false" @retry="source.reload()">
      <template #default="{ value }"><RoleEditor :role="null" :source="value" @saved="onSaved" /></template>
    </AsyncSection>
  </AdaptivePageShell>
</template>
