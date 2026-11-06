<script setup lang="ts">
import { Button } from "@wssto2/vue-core/button";
import { CodeField, useForm, type CodeMarker } from "@wssto2/vue-core/form";
import { computed } from "vue";

// The server's lint result for the saved source (`site lint-templates`): the browser checks nothing itself.
const props = defineProps<{
  save: (values: { body: string }) => Promise<unknown>;
  lint: readonly { line: number; column?: number; level: "error" | "warning"; text: string }[];
  previewUrl: string;
}>();

const form = useForm({ defaults: () => ({ body: "<h1>{{ page.title }}</h1>" }) });
const markers = computed<CodeMarker[]>(() => props.lint.map((finding) => ({ line: finding.line, column: finding.column, severity: finding.level, message: finding.text })));
// A 422 from go-core lands under "body" and shows under the editor; Ctrl/Cmd+S in the editor saves too.
const save = () => form.submit((values) => props.save(values));
</script>

<template>
  <CodeField v-bind="form.bind('body')" label="Template" language="liquid" height="32rem" :markers="markers" @save="save">
    <template #preview><iframe :src="props.previewUrl" title="Preview" class="size-full" /></template>
  </CodeField>
  <Button prominence="primary" :processing="form.submitting.value" @click="save">Save</Button>
</template>
