<script setup lang="ts">
import { Button } from "@wssto2/vue-core/button";
import { AccessGate } from "@wssto2/vue-core/platform";
import "./declarations"; // the application's permissions: a name that is not declared there is a compile error below
</script>

<template>
  <!-- One permission, or any of / all of several. The server still authorizes every request: this decides what to offer. -->
  <AccessGate permission="tickets:update"><Button prominence="primary">Edit</Button></AccessGate>
  <AccessGate :any="['tickets:update', 'accounts:view']"><Button>Export</Button></AccessGate>
  <AccessGate :all="['tickets:update', 'accounts:view']">
    <Button>Reassign</Button>
    <!-- Shown instead when access is missing -->
    <template #fallback><span class="text-footnote text-content-muted">Ask an administrator to reassign.</span></template>
  </AccessGate>
</template>
