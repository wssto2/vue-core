<script setup lang="ts">
import { Button } from "@wssto2/vue-core/button";
import { Panel } from "@wssto2/vue-core/content";
import { ApiError } from "@wssto2/vue-core/client";
import { CommandDialog, createLeaveGuard, FormGroup, leaveGuardKey, LeaveGuardRoot, TextField, useCommand, useRecordDialog } from "@wssto2/vue-core/form";
import { provide } from "vue";

// The app shell provides the leave guard; this page stands alone.
provide(leaveGuardKey, createLeaveGuard());

// A refused save: a 422 that names no field and carries the server's own sentence for the rule it enforced.
const refused = useCommand({
  defaults: () => ({ vin: "VF1RFB00X57123456" }),
  run: async () => {
    throw new ApiError({ kind: "validation", status: 422, message: "This VIN is already on another order." });
  },
});

// Someone who may only look: the same dialog and body, `editable` false.
const order = useCommand({ defaults: () => ({ vin: "", note: "" }), run: async () => ({}) });
const showOrder = () => order.present({ vin: "VF1RFB00X57123456", note: "Paid in full, delivery on Friday." });

// A new record that starts with a suggestion: closing it untouched asks nothing.
const category = useRecordDialog({ defaults: () => ({ name: "", note: "" }), create: async () => ({}) });
</script>

<template>
  <Panel title="Record dialogs">
    <div class="flex flex-wrap gap-2">
      <Button @click="refused.present()">Save a refused order</Button>
      <Button @click="showOrder">View an order (view-only)</Button>
      <Button @click="category.create({ name: 'Suggested category' })">New category with a start</Button>
    </div>
    <CommandDialog :command="refused" title="Order" confirm-label="Save">
      <FormGroup><TextField v-bind="refused.form.bind('vin')" label="VIN" /></FormGroup>
    </CommandDialog>
    <CommandDialog :command="order" title="Order" confirm-label="Save" :editable="false">
      <FormGroup>
        <TextField v-bind="order.form.bind('vin')" label="VIN" />
        <TextField v-bind="order.form.bind('note')" label="Note" />
      </FormGroup>
    </CommandDialog>
    <CommandDialog :command="category.command" title="New category" confirm-label="Save">
      <FormGroup>
        <TextField v-bind="category.form.bind('name')" label="Name" />
        <TextField v-bind="category.form.bind('note')" label="Note" />
      </FormGroup>
    </CommandDialog>
    <LeaveGuardRoot />
  </Panel>
</template>
