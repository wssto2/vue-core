import type { Plugin } from "vue";
import { createFormatting, installFormatting, type FormattingSettings } from "../format";

/** A plugin installing `Intl` formatting (`useFormat()`) that follows a test i18n's locale; `settings` are the application's (`formatting` of `createApplication`: `intlLocale`, `datePattern`, ...). */
export function testFormatting(i18n: { global: { locale: { value: string } } }, settings: FormattingSettings = {}): Plugin {
  return { install: (app) => installFormatting(app, createFormatting({ locale: () => i18n.global.locale.value, ...settings })) };
}
