<script setup lang="ts">
import { FormGroup } from "@wssto2/vue-core/form";
import { PhoneField } from "@wssto2/vue-core/phone";

const mobile = "+385912345678";
</script>

<template>
  <FormGroup :editable="false">
    <PhoneField :model-value="mobile" label="Mobile">
      <!-- Call, Message and Copy come with the field; WhatsApp is the app's own action. -->
      <template #actions="{ number }"><a :href="`https://wa.me/${number.slice(1)}`" class="rounded-full bg-tint-soft px-3 py-1.5 text-footnote text-content-link">WhatsApp</a></template>
    </PhoneField>
  </FormGroup>
</template>
