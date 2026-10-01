<script setup lang="ts">
import { Button } from "@wssto2/vue-core/button";
import { useTemplateRef } from "vue";
import { useI18n } from "vue-i18n";
import type { Category } from "../api";
import CategoryDialog from "../components/CategoryDialog.vue";

defineProps<{ categories: readonly Category[] }>();
const emit = defineEmits<{ changed: [] }>();
const { t } = useI18n();
const dialog = useTemplateRef("dialog");
</script>

<template>
  <Button prominence="primary" @click="dialog?.create()">{{ t("forms.newCategory") }}</Button>
  <ul>
    <li v-for="category in categories" :key="category.id"><Button prominence="link" @click="dialog?.edit(category)">{{ category.name }}</Button></li>
  </ul>
  <CategoryDialog ref="dialog" @saved="emit('changed')" />
</template>
