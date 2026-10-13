<script setup lang="ts">
import type { Component } from "vue";
import { useI18n } from "vue-i18n";
import { AdaptivePageShell } from "../../page";
import { usePlatform } from "../../platform";
import { AsyncSection, useLoad } from "../../state";
import { identityRoutes } from "../../modules/identity/routes";
import type { ProfileResponse } from "../../modules/identity/entities";
import { useUsersContext } from "../users/context";
import DetailsGroup from "./DetailsGroup.vue";
import EmailGroup from "./EmailGroup.vue";
import PasswordGroup from "./PasswordGroup.vue";
import { layoutProfile, type ProfileEntry, type ProfilePanel } from "./profileSections";
import SessionsGroup from "./SessionsGroup.vue";
import SignInsGroup from "./SignInsGroup.vue";

/**
 * "My profile": the signed-in person's own account as grouped rows: name and phone (changed in a sheet), the e-mail address
 * (changed with a code mailed to the new one), the password (a dialog), the devices they are signed in on and their sign-in
 * history, then the application's own groups. It needs no permission, only a session.
 */
const { t } = useI18n();
const { http, session } = usePlatform();
const { profileSections } = useUsersContext();

const profile = useLoad(async ({ signal }) => (await http.request(identityRoutes.profileShow, undefined, { signal })).data);

const groups: Record<ProfilePanel, Component> = { details: DetailsGroup, email: EmailGroup, password: PasswordGroup, sessions: SessionsGroup, signins: SignInsGroup };
const keyOf = (entry: ProfileEntry) => (entry.kind === "panel" ? entry.id : `section:${entry.section.id}`);
// Only the account groups take the profile; the sessions and sign-ins load their own.
const takesProfile = (entry: ProfileEntry) => entry.kind === "section" || ["details", "email"].includes(entry.id);

// The shell's account menu shows the name and e-mail the session knows: read them again.
function updated(next: ProfileResponse) {
  profile.update(next);
  void session.refresh();
}
</script>

<template>
  <AdaptivePageShell :title="t('core.profile.title')" :description="t('core.profile.description')" width="readable">
    <AsyncSection :state="profile.state.value" :skeleton-rows="6" :is-empty="() => false" @retry="profile.reload()">
      <template #default="{ value }">
        <div class="flex min-w-0 flex-col gap-group-gap">
          <template v-for="entry in layoutProfile(profileSections, value)" :key="keyOf(entry)">
            <div v-if="entry.kind === 'section'" class="flex min-w-0 flex-col gap-group-gap" :data-profile-section="entry.section.id">
              <component :is="entry.section.component" :profile="value" @updated="updated" />
            </div>
            <component :is="groups[entry.id]" v-else v-bind="takesProfile(entry) ? { profile: value } : {}" @updated="updated" />
          </template>
        </div>
      </template>
    </AsyncSection>
  </AdaptivePageShell>
</template>
