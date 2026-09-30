<script setup lang="ts">
import { useSaveChrome, type SaveChromeOptions } from "./useSaveChrome";

// Renders nothing: it exists so the save chrome registers from inside the page shell, which provides the chrome it registers into.
const props = defineProps<{ options: SaveChromeOptions }>();
useSaveChrome(props.options);
</script>

<template><span hidden /></template>
