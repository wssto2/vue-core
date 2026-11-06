<script setup lang="ts">
import { DynamicCollection, listLoader } from "@wssto2/vue-core/collection";
import { newsSchema } from "./schema";

// go-core's list convention (page, per_page, order_col, order_dir, search, every filter under its key); the app's API is the loader.
const load = listLoader<Record<string, unknown>>("/admin/api/v1/content/news");
</script>

<template>
  <DynamicCollection id="content.news" :schema="newsSchema" :load="load" title="News" thumbnail="/media/{id}/thumb" :record-route="(row) => `/news/${row.id}`" />
</template>
