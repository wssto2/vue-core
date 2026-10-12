<script setup lang="ts">
import { PhotoViewer, PhotoViewerAction, type PhotoViewerItem } from "@wssto2/vue-core/overlay";
import { useTemplateRef } from "vue";
import { useI18n } from "vue-i18n";

const { t } = useI18n();
const props = defineProps<{ photos: readonly { id: number; url: string; small: string; caption: string }[] }>();
const emit = defineEmits<{ makeCover: [id: number]; remove: [id: number] }>();

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
    <!-- The app's own actions on the photo on show: next to zoom in the header, in a toolbar under the photo on a phone. -->
    <template #actions="{ index }">
      <PhotoViewerAction :label="t('accounts.makeCover')" @select="emit('makeCover', props.photos[index]!.id)" />
      <PhotoViewerAction :label="t('accounts.deletePhoto')" tone="critical" @select="emit('remove', props.photos[index]!.id)" />
    </template>
  </PhotoViewer>
</template>
