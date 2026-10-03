<script setup lang="ts">
import { accessPermissions } from "@wssto2/vue-core/access";
import { Button } from "@wssto2/vue-core/button";
import { AccessGate } from "@wssto2/vue-core/platform";
</script>

<template>
  <!-- Only for the ones who may see them: `user` sees nothing here. -->
  <div class="flex gap-2">
    <AccessGate :permission="accessPermissions.viewRoles"><Button to="/iam/roles" prominence="secondary">Roles</Button></AccessGate>
    <AccessGate :permission="accessPermissions.viewAccess"><Button to="/people" prominence="secondary">People</Button></AccessGate>
  </div>
</template>
