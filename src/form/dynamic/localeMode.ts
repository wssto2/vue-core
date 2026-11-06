import type { InjectionKey, Ref } from "vue";

/** The language a form in `localeMode: "form"` is showing; its rows (`RepeatField`) follow it instead of showing a switcher of their own. */
export const activeLocaleKey: InjectionKey<Readonly<Ref<string>>> = Symbol("vue-core.dynamicForm.locale");

/** How translatable fields show their languages: a segment strip per field (`I18nField`), or one switcher for the whole form. */
export type LocaleMode = "perField" | "form";
