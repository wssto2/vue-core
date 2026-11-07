<script setup lang="ts">
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import { diffRows, isGap, splitRows, type DiffLine, type NumberedLine } from "./diff";

/**
 * A diff of two texts, drawn from the lines the server computed (`{ op, text }`, op `" "` unchanged, `"-"` removed, `"+"` added):
 * line numbers, the changes marked, and runs of unchanged lines folded to "12 unchanged lines" (a click opens them).
 * `mode="unified"` is one column, `"split"` puts the old text left and the new right. A change is told by its sign and by
 * screen-reader text ("added", "removed"), never by colour alone. Nothing changed shows a plain sentence.
 *
 *   <DiffView :lines="version.diff" mode="split" :context="3" />
 *
 * The text is not highlighted (that would load the code editor for a read-only view); it is shown as it is, in the mono font.
 */
const props = withDefaults(defineProps<{
  lines: readonly DiffLine[];
  mode?: "unified" | "split";
  /** Unchanged lines kept around each change; the rest fold. `null` folds nothing. Default 3. */
  context?: number | null;
}>(), { mode: "unified", context: 3 });

const { t } = useI18n();
const expanded = ref<ReadonlySet<number>>(new Set());
const rows = computed(() => diffRows(props.lines, props.context, expanded.value));
const sides = computed(() => (props.mode === "split" ? splitRows(rows.value) : []));
const changed = computed(() => props.lines.some((line) => line.op !== " "));

const SIGN = { " ": " ", "-": "−", "+": "+" } as const;
const CELL = { " ": "", "-": "bg-status-danger-surface text-status-danger-content", "+": "bg-status-success-surface text-status-success-content" } as const;
const spoken = (op: NumberedLine["op"]) => (op === "+" ? t("core.diff.added") : op === "-" ? t("core.diff.removed") : "");
const open = (key: number) => (expanded.value = new Set([...expanded.value, key]));
</script>

<template>
  <p v-if="!changed" role="status" class="text-footnote text-content-muted">{{ t("core.diff.identical") }}</p>
  <div v-else class="overflow-x-auto rounded-md border border-border-separator bg-surface-cell font-mono text-xs leading-5" :data-mode="props.mode" data-diff-view>
    <table class="w-full border-collapse" :aria-label="t('core.diff.label')">
      <tbody v-if="props.mode === 'unified'">
        <template v-for="(row, index) in rows" :key="isGap(row) ? `gap-${row.key}` : index">
          <tr v-if="isGap(row)" data-diff-gap>
            <td colspan="4" class="border-y border-border-separator bg-fill px-2 py-0.5 text-center">
              <button type="button" class="cursor-pointer rounded-sm px-2 text-content-muted hover:text-content-strong focus-visible:outline-2 focus-visible:outline-border-focus" @click="open(row.key)">
                {{ t("core.diff.collapsed", { count: row.lines.length }, row.lines.length) }}
              </button>
            </td>
          </tr>
          <tr v-else :class="CELL[row.op]" :data-op="row.op">
            <td class="w-10 select-none px-2 text-right tabular-nums text-content-muted">{{ row.oldNo }}</td>
            <td class="w-10 select-none px-2 text-right tabular-nums text-content-muted">{{ row.newNo }}</td>
            <td class="w-5 select-none text-center" aria-hidden="true">{{ SIGN[row.op] }}</td>
            <td class="whitespace-pre pr-3"><span v-if="row.op !== ' '" class="sr-only">{{ spoken(row.op) }}: </span>{{ row.text }}</td>
          </tr>
        </template>
      </tbody>
      <tbody v-else>
        <template v-for="(row, index) in sides" :key="isGap(row) ? `gap-${row.key}` : index">
          <tr v-if="isGap(row)" data-diff-gap>
            <td colspan="6" class="border-y border-border-separator bg-fill px-2 py-0.5 text-center">
              <button type="button" class="cursor-pointer rounded-sm px-2 text-content-muted hover:text-content-strong focus-visible:outline-2 focus-visible:outline-border-focus" @click="open(row.key)">
                {{ t("core.diff.collapsed", { count: row.lines.length }, row.lines.length) }}
              </button>
            </td>
          </tr>
          <tr v-else>
            <template v-for="(side, at) in [row.left, row.right]" :key="at">
              <td class="w-10 select-none px-2 text-right tabular-nums text-content-muted" :class="[side ? CELL[side.op] : 'bg-fill', at === 1 ? 'border-l border-border-separator' : '']">{{ at === 0 ? side?.oldNo : side?.newNo }}</td>
              <td class="w-5 select-none text-center" :class="side ? CELL[side.op] : 'bg-fill'" aria-hidden="true">{{ side ? SIGN[side.op] : "" }}</td>
              <td class="w-1/2 whitespace-pre pr-3" :class="side ? CELL[side.op] : 'bg-fill'" :data-op="side?.op">
                <template v-if="side"><span v-if="side.op !== ' '" class="sr-only">{{ spoken(side.op) }}: </span>{{ side.text }}</template>
              </td>
            </template>
          </tr>
        </template>
      </tbody>
    </table>
  </div>
</template>
