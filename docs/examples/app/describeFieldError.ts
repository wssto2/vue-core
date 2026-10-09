import type { AppFieldErrorDescriber } from "@wssto2/vue-core/i18n";

// The server sends a field's message as a key ("validation_errors.required"); `createApplication({ describeFieldError })` words it once for every form.
const sentences: Readonly<Record<string, string>> = { "validation_errors.required": "This field is required.", "validation_errors.unique": "Already in use." };
export const describeFieldError: AppFieldErrorDescriber = (message, field) => sentences[message] ?? (field === "oib" ? `OIB: ${message}` : message);
