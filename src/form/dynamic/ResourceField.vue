<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import Button from "../../button/Button.vue";
import { createPicker } from "../../collection/picker";
import PickerModal from "../../collection/PickerModal.vue";
import Field from "../Field.vue";
import { fieldDefaults, fieldProps, useFieldMode, type FieldProps } from "../field";
import ResourcePickerList from "./ResourcePickerList.vue";
import { thumbnailUrl, type ResourceId, type ResourceItem, type ResourceSource } from "./resources";

/**
 * One resource, or several, chosen from the app's media library: the value is an id (`multiple`: a list of ids). It shows each
 * as a picture from `source.thumbnail` and opens a `PickerModal` over `source.list(query)` to choose. The app owns the library;
 * uploads are its too.
 *
 *   <ResourceField v-model="form.image" :source="media" label="Image" accept="image/*" />
 *   <ResourceField v-model="form.gallery" :source="media" multiple label="Gallery" />
 */
const props = withDefaults(
  defineProps<FieldProps & {
    source: ResourceSource;
    /** Several ids, kept in the order chosen. */
    multiple?: boolean;
    /** Passed to `source.list` as `query.accept`. */
    accept?: string;
    modelValue?: ResourceId | readonly ResourceId[] | null;
  }>(),
  { ...fieldDefaults, multiple: false, accept: undefined, modelValue: undefined },
);
const emit = defineEmits<{ "update:modelValue": [value: ResourceId | ResourceId[] | null] }>();

const { t } = useI18n();
const { editable } = useFieldMode(props);
const picker = createPicker<ResourceItem>();

const ids = computed<ResourceId[]>(() => (Array.isArray(props.modelValue) ? [...props.modelValue] : props.modelValue === null || props.modelValue === undefined || props.modelValue === "" ? [] : [props.modelValue as ResourceId]));

function commit(next: ResourceId[]) {
  emit("update:modelValue", props.multiple ? next : (next[0] ?? null));
}
async function choose(replace?: number) {
  const item = await picker.pick({ title: props.label ?? t("core.form.dynamic.resource.title") });
  if (!item) return;
  const next = [...ids.value];
  if (props.multiple && replace === undefined) next.push(item.id);
  else next[replace ?? 0] = item.id;
  commit(next);
}
const remove = (index: number) => commit(ids.value.filter((_, at) => at !== index));
</script>

<template>
  <Field v-bind="fieldProps(props)" row-layout="stacked" :value="ids.length > 0 ? ids.join(', ') : null">
    <template #default="{ id }">
      <div :id="id" class="flex flex-wrap items-start gap-2">
        <div v-for="(value, index) in ids" :key="`${value}-${index}`" class="relative w-24" data-resource>
          <img :src="thumbnailUrl(props.source, value)" alt="" class="aspect-square w-full rounded-md border border-border object-cover" />
          <div v-if="editable && !props.disabled" class="mt-1 flex justify-between">
            <Button size="xs" prominence="plain" @click="choose(index)">{{ t("core.form.dynamic.resource.change") }}</Button>
            <Button size="xs" prominence="plain" tone="critical" icon="close" v-bind="{ 'aria-label': t('core.form.dynamic.resource.remove') }" @click="remove(index)" />
          </div>
        </div>
        <p v-if="ids.length === 0 && !editable" class="text-sm text-muted">{{ t("core.form.dynamic.resource.none") }}</p>
        <Button v-if="editable && !props.disabled && (props.multiple || ids.length === 0)" icon="addLine" @click="choose()">{{ t("core.form.dynamic.resource.choose") }}</Button>
      </div>
      <PickerModal :picker="picker">
        <template #default="{ select }">
          <ResourcePickerList :source="props.source" :accept="props.accept" @select="select" />
        </template>
      </PickerModal>
    </template>
  </Field>
</template>
