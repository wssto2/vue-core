<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { Avatar } from "../../content";
import { IconTile } from "../../controls";
import { useFormat } from "../../format";
import { FormGroup, FormRow } from "../../form";
import type { ChangeRow } from "../../modules/identity/entities";

/**
 * What was changed on a person's account, newest first, one sentence per change ("Details changed", "Password changed"),
 * with who did it (by the name the row carries, "somebody else" when the person is gone; nothing when it was the person themselves), what changed from what to what, and when. An action or a
 * field this version does not know reads as a generic one, never as its key; a password is never shown.
 */
const props = defineProps<{
  rows: readonly ChangeRow[];
}>();

const { t, te } = useI18n();
const format = useFormat();

// Actions that say everything in their sentence: their before and after are a state, not details.
const SENTENCE_ONLY = new Set(["created", "activated", "deactivated", "password"]);

const label = (field: string) => t(`core.users.changes.fields.${field}`);

// One piece per known field: "Name: Ana → Ana M." when the change kept the values, the field's name when it did not.
const lines = computed(() =>
  props.rows.map((row) => {
    const sentence = te(`core.users.changes.actions.${row.action}`) ? t(`core.users.changes.actions.${row.action}`) : t("core.users.changes.actions.unknown");
    const details = SENTENCE_ONLY.has(row.action)
      ? []
      : row.fields
          .filter((field) => field !== "password" && te(`core.users.changes.fields.${field}`))
          .map((field) => (field in row.before || field in row.after ? t("core.users.changes.diff", { field: label(field), before: row.before[field] || "—", after: row.after[field] || "—" }) : label(field)));
    return { row, sentence, details };
  }),
);
</script>

<template>
  <FormGroup data-change-feed>
    <FormRow v-for="line in lines" :key="line.row.id" layout="setting" :label="line.sentence" data-change-row>
      <template #leading>
        <span class="flex items-center pl-0.5">
          <Avatar v-if="line.row.actor?.name" :name="line.row.actor.name" size="sm" />
          <IconTile v-else tone="anchor" icon="edit" />
        </span>
      </template>
      <template #sub>
        <span class="flex flex-wrap items-center gap-x-1.5">
          <template v-if="line.row.actor">
            <span class="font-medium text-content" data-change-actor>{{ line.row.actor.name || t("core.account.somebody_else") }}</span>
            <span aria-hidden="true">·</span>
          </template>
          <template v-for="detail in line.details" :key="detail">
            <span>{{ detail }}</span>
            <span aria-hidden="true">·</span>
          </template>
          <span>{{ format.dateTime(line.row.created_at) }}</span>
        </span>
      </template>
    </FormRow>
  </FormGroup>
</template>
