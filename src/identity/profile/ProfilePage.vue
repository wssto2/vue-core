<script setup lang="ts">
import type { Component } from "vue";
import { useI18n } from "vue-i18n";
import { AdaptivePageShell } from "../../page";
import { usePlatform } from "../../platform";
import { AsyncSection, useLoad } from "../../state";
import { useUsersContext } from "../users/context";
import { identityRoutes } from "../../modules/identity/routes";
import type { ProfileResponse } from "../../modules/identity/entities";
import DetailsPanel from "./DetailsPanel.vue";
import EmailPanel from "./EmailPanel.vue";
import PasswordPanel from "./PasswordPanel.vue";
import SessionsPanel from "./SessionsPanel.vue";
import SignInsPanel from "./SignInsPanel.vue";
import { layoutProfile, type ProfileEntry, type ProfilePanel } from "./profileSections";

/**
 * "My profile": the signed-in person's own account: name and phone, the e-mail address (changed with a code mailed to the
 * new one), the password, the devices they are signed in on and their sign-in history. It needs no permission, only a session.
 */
const { t } = useI18n();
const { http, session } = usePlatform();
const { profileSections } = useUsersContext();

const panels: Record<ProfilePanel, Component> = { details: DetailsPanel, email: EmailPanel, password: PasswordPanel, sessions: SessionsPanel, signins: SignInsPanel };
const keyOf = (entry: ProfileEntry) => (entry.kind === "panel" ? entry.id : `section:${entry.section.id}`);
// Only the account panels take the loaded profile; the sessions and sign-ins load their own.
const takesProfile = (entry: ProfileEntry) => entry.kind === "section" || entry.id === "details" || entry.id === "email";

const profile = useLoad(async ({ signal }) => (await http.request(identityRoutes.profileShow, undefined, { signal })).data);

function columnsOf(profile: ProfileResponse) {
  const { left, right, wide } = layoutProfile(profileSections, profile);
  return [{ name: "left", entries: left }, { name: "right", entries: right }, { name: "wide", entries: wide }];
}

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
          <div v-for="column in columnsOf(value)" :key="column.name" class="flex flex-col gap-4" :class="column.name === 'wide' ? 'lg:col-span-2' : ''">
            <component :is="entry.kind === 'panel' ? panels[entry.id] : entry.section.component" v-for="entry in column.entries" :key="keyOf(entry)" v-bind="takesProfile(entry) ? { profile: value } : {}"
              :data-profile-section="entry.kind === 'section' ? entry.section.id : undefined" @updated="updated" />
          </div>
        </div>
      </template>
    </AsyncSection>
  </AdaptivePageShell>
</template>
