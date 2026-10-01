<script setup lang="ts">
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import { useKeyboardShortcut, useShortcutRegistry } from "../button";
import Modal from "./Modal.vue";

/**
 * The "?" dialog: every shortcut on the page right now, by group (`useShortcutRegistry`). Mount it once
 * in the application (a shell contribution, or next to the router outlet); it opens on "?" and lists
 * itself. A group the library has a heading for (`general`, `list`, `record`) is titled in the app's
 * language, any other by its name: give the app's groups ids and add `core.shortcuts.groups.<id>` messages.
 */
const { t, te } = useI18n();
const modal = ref<InstanceType<typeof Modal> | null>(null);
const rows = useShortcutRegistry();

useKeyboardShortcut({ key: "?", shiftKey: true, group: "general", label: () => t("core.shortcuts.show_help") }, () => modal.value?.present());

const sections = computed(() => {
  const groups = new Map<string, typeof rows.value>();
  for (const row of rows.value) groups.set(row.group ?? "general", [...(groups.get(row.group ?? "general") ?? []), row]);
  return [...groups].map(([group, items]) => ({ group, title: te(`core.shortcuts.groups.${group}`) ? t(`core.shortcuts.groups.${group}`) : group, rows: items }));
});
</script>

<template>
  <Modal ref="modal" :title="t('core.shortcuts.title')" size="sm">
    <div class="flex flex-col gap-5" data-test="shortcut-help">
      <section v-for="section in sections" :key="section.group">
        <h3 class="mb-1 text-footnote font-semibold text-content-muted uppercase">{{ section.title }}</h3>
        <dl class="divide-y divide-border-separator">
          <div v-for="row in section.rows" :key="row.label" class="flex items-center justify-between gap-4 py-1.5">
            <dt class="text-body">{{ row.label }}</dt>
            <dd class="flex shrink-0 items-center gap-1 text-footnote text-content-muted">
              <template v-for="(keys, index) in row.keys" :key="keys.join('+')">
                <span v-if="index > 0">{{ t("core.shortcuts.or") }}</span>
                <kbd v-for="key in keys" :key="key" class="min-w-6 rounded-control border border-border-separator bg-fill px-1.5 py-0.5 text-center font-mono text-content-strong">{{ key }}</kbd>
              </template>
            </dd>
          </div>
        </dl>
      </section>
      <p class="text-footnote text-content-muted">{{ t("core.shortcuts.hint") }}</p>
    </div>
  </Modal>
</template>
