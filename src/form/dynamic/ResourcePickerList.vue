<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import Button from "../../button/Button.vue";
import { thumbnailUrl, type ResourceItem, type ResourceSource } from "./resources";

/** The body of the resource picker: a search box, the app's rows as pictures, previous / next. Mounted afresh each time the dialog opens. */
const props = defineProps<{ source: ResourceSource; accept?: string }>();
const emit = defineEmits<{ select: [item: ResourceItem] }>();

const { t } = useI18n();
const search = ref("");
const page = ref(1);
const lastPage = ref(1);
const rows = ref<readonly ResourceItem[]>([]);
const status = ref<"loading" | "loaded" | "failed">("loading");
let controller: AbortController | null = null;
let timer: ReturnType<typeof setTimeout> | undefined;

async function load() {
  controller?.abort();
  const current = (controller = new AbortController());
  status.value = "loading";
  try {
    const result = await props.source.list({ search: search.value.trim(), page: page.value, pageSize: 24, ...(props.accept !== undefined ? { accept: props.accept } : {}) }, { signal: current.signal });
    if (current.signal.aborted) return; // a newer request owns the list
    rows.value = result.rows;
    lastPage.value = Math.max(1, result.lastPage);
    status.value = "loaded";
  } catch {
    if (!current.signal.aborted) status.value = "failed";
  }
}

function typed() {
  clearTimeout(timer);
  timer = setTimeout(() => {
    page.value = 1;
    void load();
  }, 250);
}
function go(by: number) {
  page.value += by;
  void load();
}

onMounted(() => void load());
onBeforeUnmount(() => {
  clearTimeout(timer);
  controller?.abort();
});
</script>

<template>
  <div class="flex flex-col gap-3 p-4">
    <input v-model="search" type="search" class="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm" :placeholder="t('core.form.dynamic.resource.search')" :aria-label="t('core.form.dynamic.resource.search')" @input="typed" />
    <p v-if="status === 'failed'" role="alert" class="text-sm text-critical">{{ t("core.form.dynamic.resource.failed") }}</p>
    <p v-else-if="status === 'loading' && rows.length === 0" class="text-sm text-muted">{{ t("core.form.dynamic.resource.loading") }}</p>
    <p v-else-if="rows.length === 0" class="text-sm text-muted">{{ t("core.form.dynamic.resource.empty") }}</p>
    <ul v-else class="grid grid-cols-3 gap-2 sm:grid-cols-4">
      <li v-for="item in rows" :key="item.id">
        <button type="button" class="flex w-full flex-col gap-1 rounded-md border border-border p-1 text-left hover:border-accent focus-visible:outline-2" @click="emit('select', item)">
          <img :src="thumbnailUrl(props.source, item.id)" :alt="item.name ?? ''" class="aspect-square w-full rounded object-cover" loading="lazy" />
          <span v-if="item.name" class="truncate text-xs">{{ item.name }}</span>
        </button>
      </li>
    </ul>
    <div class="flex justify-between">
      <Button prominence="plain" :disabled="page <= 1" @click="go(-1)">{{ t("core.form.dynamic.resource.previous") }}</Button>
      <Button prominence="plain" :disabled="page >= lastPage" @click="go(1)">{{ t("core.form.dynamic.resource.next") }}</Button>
    </div>
  </div>
</template>
