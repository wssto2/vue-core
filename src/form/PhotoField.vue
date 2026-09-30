<script setup lang="ts">
import { computed, onBeforeUnmount, ref, useTemplateRef, watch } from "vue";
import { useI18n } from "vue-i18n";
import Button from "../button/Button.vue";
import Field from "./Field.vue";
import { fieldDefaults, fieldProps, type FieldProps } from "./field";
import { checkFile, formatBytes } from "./file";

/**
 * One picture. The value is the chosen `File`, or a `string` for a picture the record already has (its URL); `null` is none.
 * The preview is made here and released when it is replaced or the field goes away. Uploading is the app's.
 *
 *   <PhotoField v-bind="form.bind('avatar')" :label="t('photo')" />
 */
const props = withDefaults(
  defineProps<FieldProps & { accept?: readonly string[]; maxSize?: number }>(),
  { ...fieldDefaults, accept: () => ["image/jpeg", "image/png", "image/webp", "image/gif"], maxSize: 5 * 1024 * 1024 },
);

const model = defineModel<File | string | null>({ default: null });
const { t } = useI18n();
const chooser = useTemplateRef<HTMLInputElement>("chooser");
const problem = ref<string | null>(null);
const objectUrl = ref<string | null>(null);

// An object URL lives until it is revoked: one per chosen file, released when the file is replaced.
function release() {
  if (objectUrl.value) URL.revokeObjectURL(objectUrl.value);
  objectUrl.value = null;
}
watch(
  model,
  (value) => {
    release();
    if (value instanceof File) objectUrl.value = URL.createObjectURL(value);
    if (value === null && chooser.value) chooser.value.value = "";
  },
  { immediate: true },
);
onBeforeUnmount(release);

const preview = computed(() => (model.value instanceof File ? objectUrl.value : model.value));

function take(file: File | undefined) {
  if (!file) return;
  const found = checkFile(file, { accept: props.accept, maxSize: props.maxSize });
  if (found) problem.value = found === "invalid_type" ? t("core.form.file.invalid_type") : t("core.form.file.too_large", { size: formatBytes(props.maxSize) });
  else {
    problem.value = null;
    model.value = file;
  }
}
</script>

<template>
  <Field v-bind="{ ...fieldProps(props), error: problem ?? props.error }" :value="preview ? t('core.form.file.choose') : null" row-layout="stacked">
    <template #readonly><img v-if="preview" :src="preview" alt="" class="size-40 rounded-group object-cover" /></template>
    <template #default="{ id, describedby, invalid }">
    <div class="flex flex-wrap items-center gap-3">
      <input :id="id" ref="chooser" type="file" class="sr-only" tabindex="-1" :accept="props.accept.join(',')" :disabled="props.disabled" :aria-describedby="describedby" :aria-invalid="invalid || undefined"
        @change="take(($event.target as HTMLInputElement).files?.[0])" />
      <img v-if="preview" :src="preview" alt="" data-test="photo-preview" class="size-28 rounded-group object-cover" />
      <Button :disabled="props.disabled" @click="chooser?.click()">{{ t("core.form.file.choose") }}</Button>
      <Button v-if="preview" prominence="plain" tone="critical" :disabled="props.disabled" @click="model = null; problem = null">{{ t("core.form.file.remove") }}</Button>
    </div>
    </template>
  </Field>
</template>
