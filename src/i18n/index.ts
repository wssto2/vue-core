import bs from "./bs.json";
import en from "./en.json";
import hr from "./hr.json";
import sl from "./sl.json";

/** A group of texts: every key is a sentence. */
type Texts<Key extends string> = { [K in Key]: string };

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
        session: { invalid: string; current: string; not_found: string };
        locale: { invalid: string };
        impersonation: { disabled: string; not_active: string };
        account: { not_found: string; inactive: string; already_active: string; already_inactive: string; self_deactivation: string };
        code: Texts<"expired" | "invalid" | "mismatch" | "no_pending" | "not_delivered" | "resend_too_soon" | "too_many_attempts" | "too_many_requests">;
        email: Texts<"disabled" | "invalid" | "taken" | "unchanged">;
        list: Texts<"dir_invalid" | "order_invalid" | "view_invalid">;
        login: Texts<"invalid" | "taken">;
        name: Texts<"invalid">;
        password: Texts<"mismatch" | "unchanged" | "weak" | "wrong">;
        phone: Texts<"invalid">;
        reauth: Texts<"locked">;
        activity: Texts<"area_unknown" | "range_invalid">;
      };
    };
    identity: {
      /** The label of a login field, on the sign-in page and in the prompt of an expired session. */
      username: string;
      signin: { title: string; password: string; submit: string; required: string };
      expired: { title: string; body: string; kept: string; sign_out: string };
      impersonation: { banner: string; banner_short: string; return: string; sign_in_as: string };
    };
    /** The screens of `usersFeature`: the list of people and a person's record. */
    users: {
      title: string;
      description: string;
      views: Texts<"active" | "locked" | "inactive" | "all">;
      columns: Texts<"person" | "login" | "last_sign_in" | "status">;
      never: string;
      status: Texts<"active" | "locked" | "inactive">;
      create: Texts<"title" | "subtitle" | "action" | "done">;
      fields: Texts<"login" | "name" | "email" | "phone" | "locale" | "password" | "password_repeat">;
      record: string;
      sections_label: string;
      sections: Texts<"general" | "signin" | "sessions" | "signins" | "changes" | "activity">;
      section_groups: Texts<"person" | "access" | "activity">;
      intro: Texts<"general" | "signin" | "sessions" | "signins" | "changes" | "activity">;
      groups: Texts<"person" | "person_footer" | "contact">;
      general: Texts<"saved" | "created" | "last_sign_in" | "never_signed_in" | "all_changes">;
      actions: Texts<"deactivate" | "deactivate_short" | "activate">;
      deactivate: Texts<"title" | "busy" | "done_label" | "done" | "row_sub" | "signs_out" | "signs_out_sub" | "cannot_sign_in" | "cannot_sign_in_sub">;
      activate: Texts<"title" | "body" | "row_sub" | "done" | "failed">;
      password: Texts<"title" | "action" | "footer" | "done">;
      signin: Texts<"lock" | "lock_footer" | "locked_title" | "not_locked" | "not_locked_sub" | "unlocks_at" | "unlock" | "unlocked" | "unlock_failed" | "password" | "password_footer" | "set_password" | "set_password_sub" | "as_header" | "as_title" | "as_sub" | "as_footer">;
      sessions: Texts<"header" | "footer" | "own_footer" | "end_all" | "end_all_title" | "end_all_body" | "ended_all">;
      activity: {
        areas: Texts<"all" | "identity" | "other">;
        areas_label: string;
        since: string;
        until: string;
        empty: string;
        footer: string;
        actions: Texts<"created" | "changed" | "deleted" | "other">;
        signed_in_as: string;
        signed_in_as_other: string;
      };
      changes: {
        empty: string;
        diff: string;
        actions: Texts<"created" | "updated" | "deactivated" | "activated" | "password" | "email" | "profile" | "unknown">;
        fields: Texts<"login" | "name" | "email" | "phone" | "locale" | "password" | "active">;
        views: Texts<"all" | "access" | "details">;
      };
    };
    /** "My profile": the signed-in person's own account. */
    profile: {
      title: string;
      description: string;
      menu: string;
      details: Texts<"title" | "login_hint" | "submit" | "saved">;
      email: Texts<"title" | "current" | "change" | "pending" | "valid_until" | "enter_code" | "cancel_change" | "change_title" | "new_email" | "current_password" | "request_hint" | "send_code" | "verify_title" | "verify_description" | "verify" | "resend" | "resend_in" | "request_new" | "changed" | "cancelled" | "code_sent" | "verify_failed" | "resend_failed" | "cancel_failed">;
      password: Texts<"title" | "current" | "new" | "repeat" | "show" | "hide" | "submit" | "changed">;
      sessions: Texts<"title" | "footer">;
      signins: Texts<"title" | "footer">;
    };
    /** What the screens of a person's account share (their own profile and an administrator's view of them). */
    account: {
      validation: Texts<"required" | "mismatch">;
      somebody_else: string;
      sessions: Texts<"empty" | "unknown_device" | "last_active" | "expires" | "this_device" | "opened_by" | "opened_by_other" | "end" | "end_title" | "end_body" | "ended" | "end_failed">;
      signins: {
        columns: Texts<"time" | "event" | "device" | "ip">;
        empty: string;
        footer_user: string;
        events: Texts<"signed_in" | "wrong_password" | "locked_out" | "refused_inactive" | "signed_in_as" | "unlocked" | "signed_out_everywhere" | "session_revoked" | "unknown">;
        events_by: Texts<"signed_in_as" | "unlocked" | "signed_out_everywhere" | "session_revoked">;
        views: Texts<"all" | "failed">;
      };
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
export { appErrorDescriberKey, useDescribeError } from "./describeError";
export type { AppErrorDescriber, DescribeError, DescribeErrorOptions } from "./describeError";
