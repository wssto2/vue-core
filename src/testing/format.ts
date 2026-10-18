import type { Plugin } from "vue";
import { createFormatting, installFormatting, type FormattingSettings } from "../format";

/** A plugin installing `Intl` formatting (`useFormat()`) that follows a test i18n's locale; `settings` are the application's (`formatting` of `createApplication`: `intlLocale`, `datePattern`, ...). */
export function testFormatting(i18n: { global: { locale: { value: string }; t?: (key: string) => string } }, settings: FormattingSettings = {}): Plugin {
  const translate = i18n.global.t && ((key: string) => i18n.global.t!(key)); // `format.day()` writes "Today" from the i18n's texts
  return { install: (app) => installFormatting(app, createFormatting({ locale: () => i18n.global.locale.value, translate, ...settings })) };
}
