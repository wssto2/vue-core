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
    /** The roles, bindings and effective-access screens (`@wssto2/vue-core/access`). */
    access: {
      title: string;
      description: string;
      new_title: string;
      new_description: string;
      new_copy_description: string;
      create: string;
      save: string;
      copy: string;
      copy_name: string;
      search: string;
      list_footer: string;
      empty: string;
      permissions: string;
      holders_count: string;
      kinds: { all: string; predefined: string; custom: string };
      role_kind: { predefined: string; custom: string; computed: string };
      groups: { role: string };
      fields: { name: string; description: string };
      notes: { predefined: string; computed: string };
      requires: string;
      modules: string;
      turn_on_all: string;
      turn_off_all: string;
      completed: string;
      name_required: string;
      too_long: string;
      saved: string;
      deleted: string;
      sensitive: string;
      system: string;
      system_group: string;
      organization_only: string;
      unowned: string;
      qualifier: { own: string; own_location: string; all: string };
      qualifier_hint: { own: string; own_location: string; all: string };
      qualifier_noun: { own: string; own_location: string; all: string };
      /** The names of hierarchy levels (`organization` is the root of an application with one level); an app adds its own under `access.levels`. */
      levels: { organization: string };
      compare: { action: string; title: string; footer: string; with: string; loading: string; failed: string; identical: string; only_in_role: string; only_in_other: string; different: string; whose: string };
      replace: { action: string; title: string; footer: string; with: string; choose: string; confirm: string; moves: string; done: string };
      delete: { action: string; title: string; body: string; failed: string };
      holders: { title: string; empty: string; service: string };
      person_roles: string;
      roles_footer: string;
      no_roles_title: string;
      no_roles_description: string;
      add_role: string;
      remove: string;
      remove_title: string;
      remove_body: string;
      added: string;
      removed: string;
      remove_failed: string;
      add: { confirm: string; scope_header: string; scope_level: string; scopes_failed: string; no_places: string; roles_loading: string; roles_failed: string; no_roles: string; role: string; role_gives: string; role_gives_footer: string; choose_role: string; choose_place: string };
      effective: { title: string; footer: string; empty: string; from_roles: string; unavailable: string; why_row: string; show_why: string; hide_why: string; all_modules: string; fewer_modules: string };
    };
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
      /** go-core's delegation refusals (`authz.escalation` …), looked up by `describeError`. */
      authz: { forbidden: string; escalation: string; self_assignment: string; last_admin: string; role_in_use: string; invalid: string };
      /** go-core's identity reasons (`identity.signin.failed` …), looked up by `describeError`. */
      identity: {
        signin: { failed: string; locked: string; inactive: string };
        session: { invalid: string };
        locale: { invalid: string };
        impersonation: { disabled: string; not_active: string };
        account: { not_found: string; inactive: string };
      };
    };
    identity: {
      /** The label of a login field, on the sign-in page and in the prompt of an expired session. */
      username: string;
      signin: { title: string; password: string; submit: string; required: string };
      expired: { title: string; body: string; kept: string; sign_out: string };
      impersonation: { banner: string; banner_short: string; return: string; sign_in_as: string };
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
