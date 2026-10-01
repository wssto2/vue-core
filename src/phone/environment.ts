import type { InjectionKey } from "vue";
import type { PhoneCountry } from "./phone";

/** What the app says about its phone numbers, once: `app.provide(phoneDefaultsKey, { defaultCountry: "HR" })`. A field's own props win. */
export interface PhoneDefaults {
  /** The country of a number typed without a dial code. */
  readonly defaultCountry?: PhoneCountry;
  /** The countries the picker lists first. */
  readonly commonCountries?: readonly PhoneCountry[];
}

export const phoneDefaultsKey: InjectionKey<PhoneDefaults> = Symbol("vue-core.phoneDefaults");
