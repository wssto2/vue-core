<script setup lang="ts">
import { useBackLinks } from "@wssto2/vue-core/page";
import { RouterLink } from "vue-router";

// From a ticket to its customer's record: the customer page's back reads "‹ <this ticket's title>" and leads here.
defineProps<{ customerId: number }>();
const { backHere } = useBackLinks();
</script>

<template>
  <!-- Called in the template: the link follows the ticket's title once it has loaded. -->
  <RouterLink :to="backHere(`/customers/${customerId}`)">Customer</RouterLink>
</template>
