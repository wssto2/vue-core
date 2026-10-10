// The types an `#option` slot hands over are public: an app names a row's scope or option without declaring its own copy.
import type { OptionSlotScope, OptionWithMeta, SelectOption } from "./index";

interface Vehicle { readonly vin: string }
declare const option: OptionWithMeta<number, Vehicle>;
const vin: string = option.meta.vin;
const asPlain: SelectOption<number, Vehicle> = option;
declare const scope: OptionSlotScope<number, Vehicle>;
const sameOption: OptionWithMeta<number, Vehicle> = scope.option;
// @ts-expect-error `meta` is there on a slot's option, with the type the options were given
const wrong: number = option.meta.vin;
void [vin, asPlain, sameOption, wrong];
