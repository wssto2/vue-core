<script setup lang="ts">
import { Button } from "@wssto2/vue-core/button";
import { FormGroup, NumberField, SelectField, useForm, useOptions } from "@wssto2/vue-core/form";
import { useI18n } from "vue-i18n";
import { useTicketFormsApi } from "../context";

const { t } = useI18n();
const api = useTicketFormsApi();
const form = useForm({ defaults: () => ({ category: null as number | null, queue: null as number | null, latitude: null as number | null, longitude: null as number | null }) });

// The queues load from the category: the latest category wins, and a queue the new category does not have is cleared.
const categories = useOptions({ load: ({ signal }) => api.categories(signal) });
const queues = useOptions({ for: () => form.values.category, load: (category, { signal }) => api.queues(category, signal) });
</script>

<template>
  <FormGroup>
    <SelectField v-bind="form.bind('category')" :label="t('forms.category')" :options="categories" />
    <SelectField v-bind="form.bind('queue')" :label="t('forms.queue')" :options="queues" :disabled="form.values.category === null">
      <template #trailing><Button prominence="primary" size="sm">{{ t("forms.save") }}</Button></template>
    </SelectField>
    <NumberField v-bind="form.bind('latitude')" :label="t('forms.latitude')" :decimals="7" :min-decimals="0" negative mono :grouping="false" />
    <NumberField v-bind="form.bind('longitude')" :label="t('forms.longitude')" :decimals="7" :min-decimals="0" negative mono :grouping="false" />
  </FormGroup>
</template>
