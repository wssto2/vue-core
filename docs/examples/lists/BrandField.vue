<script setup lang="ts">
import { CharacteristicField, SwitchField, useForm } from "@wssto2/vue-core/form";

// A form picks from the tree: the models of the chosen brand, saved as the item's id; the countries, saved as the project's own code.
const form = useForm({ defaults: () => ({ brand: null as number | null, model: null as number | null, countries: [] as string[], publish: true }) });
const brandsListId = 1; // the id of the item "Marke" (level 2): its children, on level 3, are the brands

defineProps<{ savedBrand?: { value: number; label: string } }>();
</script>

<template>
  <!-- `selected` names an inactive item that is already chosen: the server offers only active ones. -->
  <CharacteristicField v-bind="form.bind('brand')" label="Brand" :level="3" :parent="brandsListId" lang="hr" :selected="savedBrand" required />
  <CharacteristicField v-bind="form.bind('countries')" label="Countries" :level="3" :parent="2" value="code" multiple />
  <SwitchField v-bind="form.bind('publish')" label="Publish" />
</template>
