<script setup lang="ts">
/**
 * One of the app's own actions in `PhotoViewer`'s `#actions` slot ("Make cover", "Delete"), styled for the viewer's dark surface in the
 * header and in the phone toolbar (44 px tall). `tone="critical"` is the destructive one, in the danger colour. A disabled action stays
 * focusable (`aria-disabled`), like the viewer's own buttons at the end of their range, so focus does not fall out of the dialog.
 *
 *   <PhotoViewer :items="photos"><template #actions="{ index }">
 *     <PhotoViewerAction :label="t('makeCover')" @select="makeCover(index)" />
 *     <PhotoViewerAction :label="t('delete')" tone="critical" @select="remove(index)" />
 *   </template></PhotoViewer>
 */
const props = defineProps<{
  label: string;
  /** `critical` for a destructive action (Delete). */
  tone?: "critical";
  disabled?: boolean;
}>();
const emit = defineEmits<{ select: [] }>();

function select() {
  if (!props.disabled) emit("select");
}
</script>

<template>
  <button type="button" :aria-disabled="props.disabled || undefined" data-part="photo-viewer-action"
    class="flex min-h-11 shrink-0 cursor-pointer items-center justify-center rounded-full bg-white/8 px-4 text-subheadline font-medium whitespace-nowrap transition-colors duration-motion-fast hover:bg-white/16 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#6ee7b7] aria-disabled:cursor-default aria-disabled:opacity-40 aria-disabled:hover:bg-white/8"
    :class="props.tone === 'critical' ? 'text-[#ff8a80]' : 'text-[#f1f5f3]'" @click="select">{{ props.label }}</button>
</template>
