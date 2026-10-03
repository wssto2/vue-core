import bs from "./bs.json";
import en from "./en.json";
import hr from "./hr.json";
import sl from "./sl.json";

/**
 * The shape of one locale's messages: `{ core: { … } }`. Written out (not inferred from the JSON
 * files) so the published declarations do not point at files that are not shipped; every locale
 * must satisfy it, which the compiler checks below.
 */
export type CoreMessages = {
  core: {
    actions: {
      cancel: string;
      close: string;
      confirm: string;
      retry: string;
      save: string;
      saving: string;
      saved: string;
      more: string;
    };
    state: {
      loading: string;
      stale: string;
      refreshing: string;
      empty: string;
      no_value: string;
    };
    page: {
      breadcrumbs: string;
      more_actions: string;
    };
    wait: {
      seconds: string;
    };
    discard_changes: {
      title: string;
      body: string;
      confirm: string;
      cancel: string;
    };
    toast: {
      notifications: string;
    };
    shell: {
      menu: string;
      home: string;
      account: {
        open: string;
        language: string;
        sign_out: string;
        sign_out_failed: string;
      };
      update: {
        available: string;
        reload: string;
      };
    };
    no_access: {
      title: string;
      body: string;
    };
    shortcuts: {
      title: string;
      or: string;
      hint: string;
      show_help: string;
      focus_search: string;
      open_filters: string;
      groups: { general: string; list: string; record: string };
    };
    errors: {
      unauthenticated: string;
      forbidden: string;
      not_found: string;
      conflict: string;
      rate_limited: string;
      check_fields: string;
      offline: string;
      cancelled: string;
      unexpected: string;
      /** go-core's identity reasons (`identity.signin.failed` …), looked up by `describeError`. */
      identity: {
        signin: { failed: string; locked: string; inactive: string };
        session: { invalid: string };
        locale: { invalid: string };
        impersonation: { disabled: string };
        account: { not_found: string; inactive: string };
      };
    };
    identity: {
      signin: { title: string; login: string; password: string; submit: string; required: string };
    };
    startup: {
      title: string;
      session: string;
      messages: string;
      other: string;
    };
  };
};

/**
 * The library's own UI texts, under the `core` namespace, for every supported locale. An app
 * merges them into its vue-i18n messages (`i18n.global.mergeLocaleMessage(locale, coreMessages[locale])`)
 * and may override any key afterwards.
 */
export const coreMessages: { readonly en: CoreMessages; readonly hr: CoreMessages; readonly bs: CoreMessages; readonly sl: CoreMessages } = {
  en,
  hr,
  bs,
  sl,
};

export type CoreLocale = keyof typeof coreMessages;

export { localeMessages } from "./messages";
export type { LocaleMessagesOptions, MessageLoader, MessageNamespace, Messages } from "./messages";
export { createMessageRuntime } from "./runtime";
export type { MessageFailure, MessageRuntime, MessageRuntimeOptions, MessageTarget } from "./runtime";
export { useDescribeError } from "./describeError";
export type { DescribeError, DescribeErrorOptions } from "./describeError";
