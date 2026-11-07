<script setup lang="ts">
import { Tabs } from "@wssto2/vue-core/controls";
import { PreviewFrame, type PreviewDevice } from "@wssto2/vue-core/content";
import { CodeEditor, MarkerList, type CodeMarker } from "@wssto2/vue-core/form";
import { WorkbenchPage, type PageAction } from "@wssto2/vue-core/page";
import { Badge } from "@wssto2/vue-core/state";
import { computed, ref, useTemplateRef } from "vue";
import { useI18n } from "vue-i18n";
import { useRoute } from "vue-router";
import { workbenchRoutes } from "../routes";

const { t } = useI18n();
const route = useRoute();

const SAVED = `<!doctype html>
<html lang="{{ locale }}">
<head>
  <meta charset="utf-8">
  <title>{{ page.seo_title }}</title>
  {% for css in template.stylesheets %}<link rel="stylesheet" href="{{ css.path }}">{% endfor %}
</head>
<body class="page-{{ page.url | handleize }}">
  {% render 'zaglavlje-stranice' %}
  <main id="content">
    {{ content }}
  </main>
  {% render 'podnozje-stranice' %}
  {% for js in template.scripts %}<script src="{{ js.path }}">${"<"}/script>{% endfor %}
</body>
</html>`;

// The server's lint result for the saved source; `?lint=ok` shows the empty state.
const lint: CodeMarker[] = route.query.lint === "ok" ? [] : [
  { line: 5, column: 4, severity: "warning", message: "Petlja bez ograničenja (limit)" },
  { line: 9, column: 13, severity: "error", message: "Nepoznata komponenta 'zaglavlje-stranice'" },
  { line: 13, column: 13, severity: "error", message: "Nepoznata komponenta 'podnozje-stranice'" },
];

const source = ref(SAVED);
const dirty = computed(() => source.value !== SAVED);
const editor = useTemplateRef<InstanceType<typeof CodeEditor>>("editor");
const at = ref({ line: 1, column: 1 });
const device = ref<PreviewDevice>("desktop");
const section = ref("code");
const tabs = computed(() => [
  { value: "code", label: t("workbench.code") },
  { value: "components", label: t("workbench.components"), badge: 4 },
  { value: "resources", label: t("workbench.resources") },
  { value: "scripts", label: t("workbench.scripts"), badge: 2 },
  { value: "styles", label: t("workbench.styles"), badge: 3 },
  { value: "general", label: t("workbench.general") },
]);
const actions = computed<PageAction[]>(() => [
  { id: "versions", label: t("workbench.versions"), icon: "history", onClick: () => {} },
  { id: "save", label: t("workbench.save_draft"), icon: "save", disabled: !dirty.value, onClick: () => {} },
  { id: "publish", label: t("workbench.publish"), placement: "primary", onClick: () => {} },
]);
</script>

<template>
  <WorkbenchPage :title="t('workbench.template_name')" :description="t('workbench.template_meta')" :back="{ label: t('workbench.templates'), to: workbenchRoutes.template }" :actions="actions" :dirty="dirty" storage-key="playground-template">
    <template #leading><span class="grid size-10 shrink-0 place-items-center rounded-group bg-tile-brand text-tile-brand-foreground" aria-hidden="true">&lt;/&gt;</span></template>
    <template #badges>
      <Badge tone="warning">{{ t("workbench.draft") }}</Badge>
      <Badge tone="positive">{{ t("workbench.published") }}</Badge>
    </template>
    <template #subheader><Tabs v-model="section" :tabs="tabs" /></template>
    <template #start>
      <div class="flex h-full min-h-0 flex-col">
        <div class="flex shrink-0 items-center gap-2 border-b border-border-separator px-4 py-2 text-footnote">
          <span class="font-medium text-content-strong">{{ t("workbench.code") }}</span>
          <span class="text-content-muted">Liquid</span>
          <span class="ml-auto tabular-nums text-content-muted">{{ t("workbench.line_column", at) }}</span>
        </div>
        <CodeEditor ref="editor" v-model="source" class="min-h-0 flex-1" fill language="liquid" :label="t('workbench.code')" :markers="lint" @cursor="at = $event" />
        <div class="max-h-40 shrink-0 overflow-y-auto border-t border-border-separator px-4 py-2">
          <p class="mb-1 text-footnote font-medium text-content-strong">{{ t("workbench.problems") }}</p>
          <MarkerList :markers="lint" @select="(marker) => editor?.reveal(marker.line, marker.column)" />
        </div>
      </div>
    </template>
    <template #end><PreviewFrame v-model:device="device" src="/preview.html" :title="t('workbench.preview')" /></template>
  </WorkbenchPage>
</template>
