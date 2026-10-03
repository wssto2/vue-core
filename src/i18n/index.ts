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
export { useDescribeError } from "./describeError";
export type { DescribeError, DescribeErrorOptions } from "./describeError";
