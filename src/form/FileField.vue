<script setup lang="ts">
import { computed, ref, useTemplateRef, watch } from "vue";
import { useI18n } from "vue-i18n";
import Button from "../button/Button.vue";
import { Icon } from "../icon";
import Field from "./Field.vue";
import { fieldDefaults, fieldProps, type FieldProps, type FieldSlots } from "./field";
import { checkFile, formatBytes } from "./file";

/**
 * A file to upload. The field holds the chosen `File` and checks what it can (type and size) before the form does;
 * the upload itself is the app's (the form's `send` puts the file in a multipart body, or hands it to an uploader).
 *
 *   <FileField v-bind="form.bind('attachment')" :label="t('attachment')" :accept="['.pdf', 'image/*']" :max-size="5 * 1024 * 1024" />
 *   <FileField v-bind="form.bind('sheet')" variant="dropzone" :accept="['.xlsx']" />
 *
 * A file that fails the checks is not kept: the field says why (the `error` of the form, when there is one, wins only when it is clean).
 */
const props = withDefaults(
  defineProps<FieldProps & {
    /** `button` (a Choose file button) or `dropzone` (a drop area that also opens the chooser). */
    variant?: "button" | "dropzone";
    /** Extensions (".pdf"), MIME types ("image/png") or families ("image/*"). */
    accept?: readonly string[];
    /** The largest size in bytes; 0 allows any. */
    maxSize?: number;
  }>(),
  { ...fieldDefaults, variant: "button", accept: () => [], maxSize: 0 },
);

const model = defineModel<File | null>({ default: null });
const { t } = useI18n();
const chooser = useTemplateRef<HTMLInputElement>("chooser");
const dragging = ref(false);
const problem = ref<string | null>(null);

const hint = computed(() => {
  if (props.hint) return props.hint;
  const parts: string[] = [];
  if (props.accept.length) parts.push(t("core.form.file.allowed", { formats: props.accept.map((entry) => entry.replace(/^\./, "").toUpperCase()).join(", ") }));
  if (props.maxSize > 0) parts.push(t("core.form.file.max_size", { size: formatBytes(props.maxSize) }));
  return parts.join(" · ") || undefined;
});

function take(file: File | null | undefined) {
  if (!file) return;
  const found = checkFile(file, { accept: props.accept, maxSize: props.maxSize });
  if (found) {
    problem.value = found === "invalid_type" ? t("core.form.file.invalid_type") : t("core.form.file.too_large", { size: formatBytes(props.maxSize) });
    model.value = null;
  } else {
    problem.value = null;
    model.value = file;
  }
}

function clear() {
  model.value = null;
  problem.value = null;
}

// A form that resets to no file also empties the chooser, so choosing the same file again still fires `change`.
watch(model, (file) => {
  if (!file && chooser.value) chooser.value.value = "";
});

defineExpose({ clear });
defineSlots<FieldSlots>();
</script>

<template>
  <Field v-bind="{ ...fieldProps(props), hint, error: problem ?? props.error }" :value="model?.name ?? null" row-layout="stacked">
    <template #default="{ id, describedby, invalid }">
      <div class="w-full">
        <input :id="id" ref="chooser" type="file" class="sr-only" tabindex="-1" :accept="props.accept.join(',') || undefined" :disabled="props.disabled" :aria-describedby="describedby" :aria-invalid="invalid || undefined"
          @change="take(($event.target as HTMLInputElement).files?.[0])" />

        <div v-if="model" class="flex items-center gap-3 rounded-group bg-fill p-3" data-test="file-selected">
          <div class="min-w-0 flex-1">
            <p class="truncate text-body font-medium text-content-strong">{{ model.name }}</p>
            <p class="text-footnote text-content-muted">{{ formatBytes(model.size) }}</p>
          </div>
          <button type="button" :disabled="props.disabled" :aria-label="t('core.form.file.remove')" :title="t('core.form.file.remove')"
            class="flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-full text-content-muted hover:bg-fill-strong focus-visible:outline-2 focus-visible:outline-border-focus disabled:cursor-not-allowed" @click="clear">
            <Icon name="close" :size="14" />
          </button>
        </div>

        <div v-else-if="props.variant === 'dropzone'" role="button" tabindex="0" data-test="file-dropzone" :aria-disabled="props.disabled || undefined"
          class="cursor-pointer rounded-group border-2 border-dashed p-6 text-center text-body transition-colors duration-motion-fast focus-visible:outline-2 focus-visible:outline-border-focus"
          :class="dragging ? 'border-border-focus bg-tint-soft' : 'border-border-control hover:bg-fill'"
          @click="!props.disabled && chooser?.click()" @keydown.enter.prevent="!props.disabled && chooser?.click()" @keydown.space.prevent="!props.disabled && chooser?.click()"
          @dragover.prevent="dragging = true" @dragleave.prevent="dragging = false" @drop.prevent="dragging = false; if (!props.disabled) take($event.dataTransfer?.files?.[0])">
          <span class="font-semibold text-content-link">{{ t("core.form.file.choose") }}</span>
          <span class="text-content-muted"> {{ t("core.form.file.drop") }}</span>
        </div>

        <Button v-else :disabled="props.disabled" @click="chooser?.click()">{{ t("core.form.file.choose") }}</Button>
      </div>
    </template>
    <template v-if="$slots.trailing" #trailing><slot name="trailing" /></template>
    <template v-if="$slots.labelTrailing" #labelTrailing><slot name="labelTrailing" /></template>
    <template v-if="$slots.readonly" #readonly><slot name="readonly" /></template>
  </Field>
</template>
