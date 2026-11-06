<script setup lang="ts">
import { buildValidator, DynamicForm, useForm } from "@wssto2/vue-core/form";
import { Button } from "@wssto2/vue-core/button";
import { ApiError } from "@wssto2/vue-core/client";
import * as zod from "zod";
import { media, newsSchema } from "./schema";

const props = defineProps<{ save: (values: Record<string, unknown>) => Promise<unknown> }>();

// Zod is passed in: it is an optional peer, and an app that never validates a schema does not load it.
const form = useForm<Record<string, unknown>>({
  defaults: () => ({ replied: false, slides: [] }),
  validator: buildValidator(newsSchema, { zod, defaultLocale: "hr" }),
});

async function submit() {
  // A 422 from go-core lands under the field keys; the fields show it.
  const result = await form.submit((values) => props.save(values));
  if (result.status === "failed" && !(result.failure.error instanceof ApiError)) console.warn(result.failure.message);
}
</script>

<template>
  <DynamicForm
    :schema="newsSchema" :model-value="form.values" :locales="['hr', 'en']" default-locale="hr" locale-mode="form"
    :errors="form.errors.all()" :resources="media" @update:model-value="Object.assign(form.values, $event)" />
  <Button prominence="primary" :processing="form.submitting.value" @click="submit">Save</Button>
</template>
