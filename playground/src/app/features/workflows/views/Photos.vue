<script setup lang="ts">
import { FormGroup, PhotoField } from "@wssto2/vue-core/form";
import { PhotoViewer, type PhotoViewerItem } from "@wssto2/vue-core/overlay";
import { AdaptivePageShell } from "@wssto2/vue-core/page";
import { ref, useTemplateRef } from "vue";
import { useI18n } from "vue-i18n";
import { placeholderPhoto } from "../data";
import { workflowRoutes } from "../routes";

// A gallery of twelve pictures and one PhotoField, both opening the same viewer. The pictures are drawn here; a real app gives URLs.
const { t } = useI18n();
const viewer = useTemplateRef<InstanceType<typeof PhotoViewer>>("viewer");
const photos: PhotoViewerItem[] = Array.from({ length: 12 }, (_unused, at) => ({
  src: placeholderPhoto(at + 1),
  thumb: placeholderPhoto(at + 1, { width: 320, height: 200 }),
  alt: t("workflows.photos.alt", { n: at + 1 }),
  downloadName: `golf-${at + 1}.svg`,
}));
const cover = ref<string | File | null>(placeholderPhoto(1));
</script>

<template>
  <AdaptivePageShell :title="t('workflows.photos.title')" :description="t('workflows.photos.intro')" :back="{ label: t('workflows.title'), to: workflowRoutes.index }" width="content">
    <ul class="grid grid-cols-3 gap-2 md:grid-cols-4">
      <li v-for="(photo, at) in photos" :key="photo.src">
        <button type="button" class="block aspect-8/5 w-full cursor-zoom-in overflow-hidden rounded-group focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus" :aria-label="photo.alt" @click="viewer?.present(at)">
          <img :src="photo.thumb" alt="" class="size-full object-cover" />
        </button>
      </li>
    </ul>

    <FormGroup :header="t('workflows.photos.field')" :footer="t('workflows.photos.fieldHint')">
      <PhotoField v-model="cover" :label="t('workflows.photos.cover')" />
    </FormGroup>

    <PhotoViewer ref="viewer" :items="photos" title="VW Golf 8" />
  </AdaptivePageShell>
</template>
