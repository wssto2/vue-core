import type { Plugin } from "vue";
import { createFormatting, installFormatting } from "../format";

/** A plugin installing `Intl` formatting that follows a test i18n's locale. Not public. */
export function testFormatting(i18n: { global: { locale: { value: string } } }): Plugin {
  return { install: (app) => installFormatting(app, createFormatting({ locale: () => i18n.global.locale.value })) };
}
