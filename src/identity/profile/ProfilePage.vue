<script setup lang="ts">
import { useI18n } from "vue-i18n";
import { AdaptivePageShell } from "../../page";
import { usePlatform } from "../../platform";
import { AsyncSection, useLoad } from "../../state";
import { identityRoutes } from "../../modules/identity/routes";
import type { ProfileResponse } from "../../modules/identity/entities";
import DetailsPanel from "./DetailsPanel.vue";
import EmailPanel from "./EmailPanel.vue";
import PasswordPanel from "./PasswordPanel.vue";
import SessionsPanel from "./SessionsPanel.vue";
import SignInsPanel from "./SignInsPanel.vue";

/**
 * "My profile": the signed-in person's own account: name and phone, the e-mail address (changed with a code mailed to the
 * new one), the password, the devices they are signed in on and their sign-in history. It needs no permission, only a session.
 */
const { t } = useI18n();
const { http, session } = usePlatform();

const profile = useLoad(async ({ signal }) => (await http.request(identityRoutes.profileShow, undefined, { signal })).data);

// The shell's account menu shows the name and e-mail the session knows: read them again.
function updated(next: ProfileResponse) {
  profile.update(next);
  void session.refresh();
}
</script>

<template>
  <AdaptivePageShell :title="t('core.profile.title')" :description="t('core.profile.description')" width="content">
    <AsyncSection :state="profile.state.value" :skeleton-rows="6" :is-empty="() => false" @retry="profile.reload()">
      <template #default="{ value }">
        <div class="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
          <div class="flex flex-col gap-4">
            <DetailsPanel :profile="value" @updated="updated" />
            <EmailPanel :profile="value" @updated="updated" />
          </div>
          <PasswordPanel />
          <SessionsPanel class="lg:col-span-2" />
          <SignInsPanel class="lg:col-span-2" />
        </div>
      </template>
    </AsyncSection>
  </AdaptivePageShell>
</template>
