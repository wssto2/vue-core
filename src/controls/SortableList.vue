<script setup lang="ts" generic="Item">
import { computed, nextTick, ref, useId, useTemplateRef } from "vue";
import { useI18n } from "vue-i18n";
import { Icon } from "../icon";

/**
 * An ordered list the user rearranges: each row has a drag handle (a button), and the handle also moves the row from the keyboard,
 * Alt+↑ / Alt+↓, with the new position spoken through a live region ("Hero moved to position 2 of 5"). The order is the `v-model`
 * (a new array each time); `item-key` names what identifies a row (a property, or a function), so rows keep their state while they move.
 *
 *   <SortableList v-model="components" item-key="id" :label="t('page.components')" :item-label="(c) => c.name">
 *     <template #item="{ item }"><ComponentRow :component="item" /></template>
 *   </SortableList>
 *
 * Dragging with a pointer shows where the row will land and moves it on release. Vertical lists only; `disabled` hides the handles
 * (a viewer who may not reorder). `plain` draws the rows without their card (no border, background or gap) and puts the handle at the top, the
 * height of the first line (`--sortable-row-height`, 2.5rem): for rows that hold more than a line, such as a tree's branches, where a row
 * has its own list inside it.
 */
const props = withDefaults(defineProps<{
  itemKey: (keyof Item & string) | ((item: Item) => string | number);
  /** The accessible name of the list. */
  label?: string;
  /** What the handle and the announcement call a row; by default the row's key. */
  itemLabel?: (item: Item) => string;
  disabled?: boolean;
  plain?: boolean;
}>(), { label: undefined, itemLabel: undefined, disabled: false, plain: false });

const model = defineModel<Item[]>({ required: true });
const emit = defineEmits<{ /** After a move, with where the item went. */ move: [item: Item, from: number, to: number] }>();
defineSlots<{ item?: (scope: { item: Item; index: number; dragging: boolean }) => unknown }>();

const { t } = useI18n();
const hintId = useId();
const list = useTemplateRef<HTMLElement>("list");
const announcement = ref("");
const dragging = ref<{ from: number; to: number; offset: number } | null>(null);

const keyOf = (item: Item): string | number => (typeof props.itemKey === "function" ? props.itemKey(item) : (item[props.itemKey] as string | number));
const nameOf = (item: Item) => props.itemLabel?.(item) ?? String(keyOf(item));
const total = computed(() => model.value.length);

function move(from: number, to: number) {
  const target = Math.min(Math.max(to, 0), model.value.length - 1);
  if (from === target) return false;
  const next = [...model.value];
  const [item] = next.splice(from, 1) as [Item];
  next.splice(target, 0, item);
  model.value = next;
  emit("move", item, from, target);
  announcement.value = t("core.sortable.moved", { item: nameOf(item), position: target + 1, total: total.value });
  return true;
}

async function onKey(event: KeyboardEvent, index: number) {
  if (!event.altKey || (event.key !== "ArrowUp" && event.key !== "ArrowDown")) return;
  event.preventDefault();
  const handle = event.currentTarget as HTMLElement;
  if (move(index, index + (event.key === "ArrowUp" ? -1 : 1))) {
    await nextTick();
    // The row keeps its element (keyed), but focus is put back for browsers that drop it when a node moves.
    if (document.activeElement !== handle) handle.focus();
  }
}

function rows() {
  return Array.from(list.value?.querySelectorAll<HTMLElement>(":scope > [data-sortable-row]") ?? []);
}

function startDrag(event: PointerEvent, index: number) {
  if (props.disabled || event.button !== 0) return;
  const handle = event.currentTarget as HTMLElement;
  handle.setPointerCapture?.(event.pointerId);
  const origin = event.clientY;
  dragging.value = { from: index, to: index, offset: 0 };
  const over = (y: number) => {
    const boxes = rows().map((row) => row.getBoundingClientRect());
    const at = boxes.findIndex((box) => y < box.top + box.height / 2);
    return at < 0 ? boxes.length - 1 : at;
  };
  const onMove = (next: PointerEvent) => {
    if (dragging.value) dragging.value = { from: index, to: over(next.clientY), offset: next.clientY - origin };
  };
  const end = (next: PointerEvent) => {
    handle.removeEventListener("pointermove", onMove);
    handle.removeEventListener("pointerup", end);
    handle.removeEventListener("pointercancel", end);
    const drop = next.type === "pointerup" ? dragging.value : null;
    dragging.value = null;
    if (drop) move(drop.from, drop.to);
  };
  handle.addEventListener("pointermove", onMove);
  handle.addEventListener("pointerup", end);
  handle.addEventListener("pointercancel", end);
}
</script>

<template>
  <div>
    <ul ref="list" :aria-label="props.label" class="flex flex-col" :class="props.plain ? '' : 'gap-1.5'" data-sortable-list>
      <li v-for="(item, index) in model" :key="keyOf(item)" data-sortable-row
        class="relative flex items-stretch gap-1"
        :class="[props.plain ? (dragging?.from === index ? 'bg-surface-cell' : '') : 'rounded-md border border-border-separator bg-surface-cell', dragging?.from === index ? 'z-10 shadow-md' : '', dragging && dragging.from !== index && dragging.to === index ? (dragging.to > dragging.from ? 'border-b-2 border-b-border-focus' : 'border-t-2 border-t-border-focus') : '']"
        :style="dragging?.from === index ? { transform: `translateY(${dragging.offset}px)` } : undefined">
        <button v-if="!props.disabled" type="button" data-sortable-handle :aria-label="t('core.sortable.handle', { item: nameOf(item) })" :aria-describedby="hintId"
          class="flex w-7 shrink-0 cursor-grab touch-none items-center justify-center text-content-muted hover:bg-fill focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-border-focus"
          :class="props.plain ? 'self-start rounded-md' : 'rounded-l-md'" :style="props.plain ? { height: 'var(--sortable-row-height, 2.5rem)' } : undefined"
          @keydown="onKey($event, index)" @pointerdown="startDrag($event, index)">
          <Icon name="draggable" :size="16" />
        </button>
        <span v-else-if="props.plain" class="w-7 shrink-0" aria-hidden="true"></span>
        <div class="min-w-0 flex-1" :class="props.plain ? '' : 'py-1.5 pr-2'"><slot name="item" :item="item" :index="index" :dragging="dragging?.from === index" /></div>
      </li>
    </ul>
    <p :id="hintId" class="sr-only">{{ t("core.sortable.hint") }}</p>
    <p role="status" aria-live="polite" class="sr-only" data-sortable-live>{{ announcement }}</p>
  </div>
</template>
