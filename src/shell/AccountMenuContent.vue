<script setup lang="ts">
import { computed, provide, ref, useId } from "vue";
import { useI18n } from "vue-i18n";
import { ShellOutlet } from "../app/contributions";
import { useShellContributions } from "../app/contributions";
import { useApplication } from "../app/environment";
import { Icon } from "../icon";
import CountryFlag from "../internal/CountryFlag.vue";
import { toast } from "../overlay";
import { usePlatform } from "../platform/platform";
import AccountMenuItem from "./AccountMenuItem.vue";
import { accountMenuKey } from "./accountMenu";

/**
 * What the account menu holds, for both presentations: the entries features contributed
 * (`accountMenu` slot), the language (when the application offers more than one), and Sign out.
 * The owner closes its popover or sheet on `close`.
 */
const props = defineProps<{ appearance: "popover" | "sheet" }>();
const emit = defineEmits<{ close: [] }>();

const { t } = useI18n();
const { session } = usePlatform();
const application = useApplication();
const contributions = useShellContributions();

provide(accountMenuKey, { appearance: props.appearance, close: () => emit("close") });

const sheet = props.appearance === "sheet";
const hasContributions = computed(() => contributions.get("accountMenu").length > 0);
const offersLocales = application.locales.length > 1;

// The language is one row until asked for: the full list is rarely needed and would dominate the menu.
const localesOpen = ref(false);
const localesId = useId();
const languageName = (code: string): string => {
  try {
    const name = new Intl.DisplayNames([code], { type: "language" }).of(code);
    return name ? name.charAt(0).toLocaleUpperCase(code) + name.slice(1) : code;
  } catch {
    return code;
  }
};
const currentLanguage = computed(() => languageName(application.locale.value));
const flagOf = (code: string): string | undefined => application.localeFlags[code];

async function signOut() {
  try {
    await session.signOut();
  } catch {
    // The session ended here (the router is already on its way to the sign-in page), but the server did not confirm it.
    toast.error(t("core.shell.account.sign_out_failed"));
  }
}

const GROUP = sheet ? "overflow-hidden rounded-group bg-surface-cell shadow-group" : "";
</script>

<template>
  <div :class="sheet ? 'flex flex-col gap-group-gap text-content-strong' : '-m-1.5 space-y-1 *:not-first:border-t *:not-first:border-border-separator *:not-first:pt-1'" data-shell-account-menu>
    <div v-if="hasContributions" :class="GROUP"><ShellOutlet name="accountMenu" /></div>

    <div v-if="offersLocales" :class="GROUP">
      <div :class="sheet ? 'relative' : ''">
        <button type="button" :aria-expanded="localesOpen" :aria-controls="localesId" data-account-language
          class="flex w-full cursor-pointer items-center gap-3 text-left transition-colors duration-motion-fast focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-border-focus"
          :class="sheet ? 'min-h-row px-row-inset py-2 text-body active:bg-fill' : 'rounded-md px-2 py-1.5 text-sm hover:bg-fill'"
          @click="localesOpen = !localesOpen">
          <Icon name="translate" :size="sheet ? 22 : 16" class="shrink-0 text-content-muted" />
          <span class="min-w-0 flex-1 truncate">{{ t("core.shell.account.language") }}</span>
          <span class="flex shrink-0 items-center gap-1.5 text-content-muted" :class="sheet ? '' : 'text-xs'">
            <CountryFlag v-if="flagOf(application.locale.value)" :country="flagOf(application.locale.value)!" />{{ currentLanguage }}
          </span>
          <Icon name="arrowDownSLine" :size="sheet ? 18 : 16" class="shrink-0 text-content-disabled transition-transform duration-motion-fast" :class="localesOpen ? 'rotate-180' : ''" />
        </button>
      </div>
      <div v-show="localesOpen" :id="localesId" :class="sheet ? '' : 'space-y-0.5 pl-4'">
        <AccountMenuItem v-for="code in application.locales" :key="code" :label="languageName(code)" :flag="flagOf(code)" :selected="code === application.locale.value"
          @click="application.setLocale(code)" />
      </div>
    </div>

    <div :class="GROUP">
      <AccountMenuItem :label="t('core.shell.account.sign_out')" icon="logoutBoxRLine" tone="critical" @click="signOut" />
    </div>
  </div>
</template>
