<script setup lang="ts">
import { Button } from "@wssto2/vue-core/button";
import { PhotoViewer, type PhotoViewerItem } from "@wssto2/vue-core/overlay";
import { useTemplateRef } from "vue";
import { useI18n } from "vue-i18n";

const { t } = useI18n();
const props = defineProps<{ photos: readonly { id: number; url: string; small: string; caption: string }[] }>();
const emit = defineEmits<{ makeCover: [id: number] }>();

// Typed items: the picture, an optional small one for the strip, what it shows, the file name Download suggests.
const items = (): PhotoViewerItem[] => props.photos.map((photo) => ({ src: photo.url, thumb: photo.small, alt: photo.caption, downloadName: `${photo.caption}.jpg` }));
const viewer = useTemplateRef<InstanceType<typeof PhotoViewer>>("viewer");
</script>

<template>
  <ul class="grid grid-cols-4 gap-2">
    <li v-for="(photo, at) in props.photos" :key="photo.id">
      <button type="button" :aria-label="photo.caption" @click="viewer?.present(at)"><img :src="photo.small" alt="" class="aspect-8/5 w-full object-cover" /></button>
    </li>
  </ul>

  <PhotoViewer ref="viewer" :items="items()" :title="t('accounts.photos')">
    <!-- Your own buttons next to zoom, rotate and download, given the photo on show. -->
    <template #actions="{ index }"><Button prominence="plain" @click="emit('makeCover', props.photos[index]!.id)">{{ t("accounts.makeCover") }}</Button></template>
  </PhotoViewer>
</template>
