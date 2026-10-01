<script setup lang="ts">
import { Badge, type Hue } from "@wssto2/vue-core/state";

defineProps<{ source: string }>();

// Your categories map to hues in one place. A hue says "of this kind", never "in this state": statuses keep `tone`.
const HUE_OF_SOURCE: Record<string, Hue> = { instagram: "violet", facebook: "blue", referral: "teal", website: "cyan", fair: "amber" };
</script>

<template>
  <div class="flex items-center gap-2">
    <!-- Tinted: the label in the hue on its tint. -->
    <Badge :hue="HUE_OF_SOURCE[source] ?? 'indigo'">{{ source }}</Badge>
    <!-- Dot: a neutral label with the hue as a dot, quieter in a dense table. -->
    <Badge :hue="HUE_OF_SOURCE[source] ?? 'indigo'" appearance="dot">{{ source }}</Badge>
    <!-- A state next to it keeps its own colours. -->
    <Badge tone="positive" dot>Active</Badge>
  </div>
</template>
