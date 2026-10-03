<script setup lang="ts">
import { useI18n } from "vue-i18n";
import { Button } from "../../button";

/** Paging for a list that is not a collection (a person's sign-ins, changes): the page and previous / next. Nothing for one page. */
const props = defineProps<{ page: number; lastPage: number; total: number }>();
const emit = defineEmits<{ "update:page": [page: number] }>();

const { t } = useI18n();
</script>

<template>
  <div v-if="props.lastPage > 1" class="flex items-center justify-between gap-3 px-row-inset text-footnote text-content-muted" data-page-bar>
    <span>{{ t("core.collection.page.page_of", { current: props.page, total: props.lastPage }) }} · {{ props.total }}</span>
    <span class="flex gap-2">
      <Button size="sm" :disabled="props.page <= 1" @click="emit('update:page', props.page - 1)">{{ t("core.collection.page.previous") }}</Button>
      <Button size="sm" :disabled="props.page >= props.lastPage" @click="emit('update:page', props.page + 1)">{{ t("core.collection.page.next") }}</Button>
    </span>
  </div>
</template>
