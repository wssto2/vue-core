<script setup lang="ts">
import { Button } from "@wssto2/vue-core/button";
import { Panel } from "@wssto2/vue-core/content";
import { Calendar, CommandDialog, createLeaveGuard, FormGroup, leaveGuardKey, LeaveGuardRoot, MoneyField, NumberField, TextField, useCommand } from "@wssto2/vue-core/form";
import { useFormat } from "@wssto2/vue-core/format";
import { onBeforeUnmount, provide, ref } from "vue";

// `?locale=bs` shows Bosnian on Chromium, whose ICU has no `bs` data: the library hands Intl `sr-Latn-BA`.
const format = useFormat();
const amount = ref<number | null>(1234.5);
const quantity = ref<number | null>(400000.5);
const day = ref<string | null>("2026-10-10");

// The app shell provides the leave guard; this page stands alone.
provide(leaveGuardKey, createLeaveGuard());

// A command whose primary action waits for a load.
const loading = ref(true);
const distribute = useCommand({ defaults: () => ({ note: "" }), run: async () => ({ ok: true }) });
let timer: ReturnType<typeof setTimeout> | undefined;
function openDialog() {
  loading.value = true;
  distribute.present();
  clearTimeout(timer);
  timer = setTimeout(() => (loading.value = false), 4000);
}
onBeforeUnmount(() => clearTimeout(timer));
</script>

<template>
  <Panel title="Locale data">
    <div class="flex flex-col gap-4">
      <p class="text-body text-content-strong">{{ format.number(400000.5, { minimumFractionDigits: 2 }) }} · {{ format.money(1234.5, "BAM") }} · {{ format.date(new Date(2026, 9, 10)) }}</p>
      <FormGroup>
        <NumberField v-model="quantity" label="Quantity" :decimals="2" />
        <MoneyField v-model="amount" label="Amount" currency="KM" />
      </FormGroup>
      <Calendar v-model="day" />
      <div><Button @click="openDialog">Distribute…</Button></div>
      <CommandDialog :command="distribute" title="Distribute" confirm-label="Apply" :confirm-disabled="loading" message="The proposal is loading; Apply waits for it.">
        <FormGroup><TextField v-bind="distribute.form.bind('note')" label="Note" /></FormGroup>
      </CommandDialog>
      <LeaveGuardRoot />
    </div>
  </Panel>
</template>
