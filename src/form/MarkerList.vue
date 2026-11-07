<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { Icon } from "../icon";
import type { CodeMarker } from "./codeEditor";

/**
 * The findings of the server's linter as a list under the editor: errors first, then warnings, each group headed by its count
 * ("2 greške"; the plural forms of the locale), each finding one button ("Redak 6, stupac 2 · message") that reports `select`
 * so the app can `reveal` the line in the `CodeEditor`. Nothing to list shows "All clear" ("U redu"). Severity is a word and an
 * icon, never a colour alone. The buttons are in the tab order.
 *
 *   <MarkerList :markers="lint" @select="(marker) => editor?.reveal(marker.line, marker.column)" />
 *
 * Counts use the plural rules of the application's locale: `createApplication` installs them; a bare `createI18n` needs `pluralRules: slavicPluralRules`.
 */
const props = defineProps<{ markers: readonly CodeMarker[] }>();
const emit = defineEmits<{ select: [marker: CodeMarker] }>();

const { t } = useI18n();
const order = (a: CodeMarker, b: CodeMarker) => a.line - b.line || (a.column ?? 0) - (b.column ?? 0);
const groups = computed(() =>
  (["error", "warning"] as const)
    .map((severity) => ({ severity, items: props.markers.filter((marker) => marker.severity === severity).sort(order) }))
    .filter((group) => group.items.length > 0),
);
const where = (marker: CodeMarker) =>
  marker.column ? t("core.form.markers.line_column", { line: marker.line, column: marker.column }) : t("core.form.markers.line", { line: marker.line });
</script>

<template>
  <div data-marker-list :aria-label="t('core.form.markers.label')" role="group">
    <p v-if="groups.length === 0" role="status" data-marker-ok class="flex items-center gap-1.5 text-footnote text-status-success-content">
      <Icon name="checkboxCircleFill" :size="14" />{{ t("core.form.markers.ok") }}
    </p>
    <section v-for="group in groups" :key="group.severity" :data-severity="group.severity" class="not-first:mt-2">
      <h3 class="flex items-center gap-1.5 text-footnote font-semibold" :class="group.severity === 'error' ? 'text-status-danger-content' : 'text-status-warning-content'">
        <Icon :name="group.severity === 'error' ? 'errorWarningLine' : 'alertTriangle'" :size="14" />
        {{ t(group.severity === "error" ? "core.form.markers.errors" : "core.form.markers.warnings", { count: group.items.length }, group.items.length) }}
      </h3>
      <ul>
        <li v-for="(marker, index) in group.items" :key="index">
          <button type="button" data-marker class="flex w-full cursor-pointer items-baseline gap-2 rounded-sm px-1 py-0.5 text-left text-footnote hover:bg-fill focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-border-focus" @click="emit('select', marker)">
            <span class="shrink-0 font-mono text-content-muted">{{ where(marker) }}</span>
            <span class="min-w-0 text-content-strong">{{ marker.message }}</span>
          </button>
        </li>
      </ul>
    </section>
  </div>
</template>
