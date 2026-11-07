<script setup lang="ts">
import { PreviewFrame, type PreviewDevice } from "@wssto2/vue-core/content";
import { CodeEditor, MarkerList, type CodeMarker } from "@wssto2/vue-core/form";
import { WorkbenchPage, type PageAction } from "@wssto2/vue-core/page";
import { computed, ref, useTemplateRef } from "vue";

// The server's lint result for the saved source: the browser checks nothing itself.
const props = defineProps<{
  name: string;
  saved: string;
  lint: readonly { line: number; column?: number; level: "error" | "warning"; text: string }[];
  previewUrl: string;
  save: (source: string) => Promise<unknown>;
}>();

const source = ref(props.saved);
const dirty = computed(() => source.value !== props.saved);
const editor = useTemplateRef<InstanceType<typeof CodeEditor>>("editor");
const at = ref({ line: 1, column: 1 });
const device = ref<PreviewDevice>("desktop");
const markers = computed<CodeMarker[]>(() => props.lint.map((finding) => ({ line: finding.line, column: finding.column, severity: finding.level, message: finding.text })));
const save = () => props.save(source.value);
const actions = computed<PageAction[]>(() => [{ id: "save", label: "Save draft", icon: "save", placement: "primary", disabled: !dirty.value, onClick: save }]);
</script>

<template>
  <!-- storage-key remembers where the user dragged the divider; the panes stack below lg. -->
  <WorkbenchPage :title="props.name" :back="{ label: 'Templates', to: '/templates' }" :actions="actions" :dirty="dirty" storage-key="template-editor">
    <template #badges><span class="rounded-full bg-status-warning-surface px-2 py-0.5 text-footnote text-status-warning-content">Draft</span></template>
    <template #start>
      <div class="flex h-full min-h-0 flex-col">
        <div class="flex shrink-0 items-center justify-between border-b border-border-separator px-4 py-2 text-footnote text-content-muted">
          <span>Liquid</span>
          <span>Line {{ at.line }}, column {{ at.column }}</span>
        </div>
        <CodeEditor ref="editor" v-model="source" class="min-h-0 flex-1" fill language="liquid" label="Template" :markers="markers" @cursor="at = $event" @save="save" />
        <div class="max-h-40 shrink-0 overflow-y-auto border-t border-border-separator px-4 py-2">
          <!-- A click on a finding puts the cursor on its line. -->
          <MarkerList :markers="markers" @select="(marker) => editor?.reveal(marker.line, marker.column)" />
        </div>
      </div>
    </template>
    <template #end><PreviewFrame v-model:device="device" :src="props.previewUrl" title="Preview" /></template>
  </WorkbenchPage>
</template>
