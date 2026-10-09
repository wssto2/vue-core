import { describe, expect, it } from "vitest";
import { coreMessages } from "./index";

function entries(value: unknown, prefix = ""): [string, string][] {
  if (typeof value === "string") return [[prefix, value]];
  return Object.entries(value as object).flatMap(([key, child]) => entries(child, prefix ? `${prefix}.${key}` : key));
}

const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort();
const segments = (text: string) => text.split("|").length;
const texts = (locale: keyof typeof coreMessages) => Object.fromEntries(entries(coreMessages[locale]));

describe("core messages", () => {
  const reference = entries(coreMessages.en);

  it.each(["hr", "bs", "sl", "sr-Latn"] as const)("%s has exactly the keys of en", (locale) => {
    expect(entries(coreMessages[locale]).map(([key]) => key).sort()).toEqual(reference.map(([key]) => key).sort());
  });

  it.each(["hr", "bs", "sl", "sr-Latn"] as const)("%s keeps the placeholders of en and the count of | segments", (locale) => {
    const own = texts(locale);
    for (const [key, text] of reference) {
      expect(placeholders(own[key]!), key).toEqual(placeholders(text));
      expect(segments(own[key]!), key).toBe(segments(text));
    }
  });

  it("has no empty text", () => {
    for (const messages of Object.values(coreMessages)) for (const [, text] of entries(messages)) expect(text.trim()).not.toBe("");
  });

  it("says Save, Unsaved changes and Choose in Bosnian, as the applications do", () => {
    const bs = texts("bs");
    expect(bs["core.actions.save"]).toBe("Sačuvaj");
    expect(bs["core.actions.saving"]).toBe("Čuvam…");
    expect(bs["core.form.unsaved_changes"]).toBe("Nesačuvane promjene");
    expect(bs["core.discard_changes.title"]).toBe("Nesačuvane promjene");
    expect(bs["core.form.select.choose"]).toBe("Izaberite…");
    expect(bs["core.collection.date_presets.options.this_week"]).toBe("Ova sedmica");
    expect(bs["core.toast.notifications"]).toBe("Obavještenja");
  });

  it("says the same in ekavian Latin Serbian", () => {
    const sr = texts("sr-Latn");
    expect(sr["core.actions.save"]).toBe("Sačuvaj");
    expect(sr["core.form.unsaved_changes"]).toBe("Nesačuvane promene");
    expect(sr["core.form.select.choose"]).toBe("Izaberite…");
    expect(sr["core.toast.notifications"]).toBe("Obaveštenja");
    expect(sr["core.form.date.next_month"]).toBe("Sledeći mesec");
  });

  it("keeps no Croatian save or choose verb in Bosnian or Serbian", () => {
    for (const locale of ["bs", "sr-Latn"] as const) for (const [key, text] of entries(coreMessages[locale])) expect(text, `${locale} ${key}`).not.toMatch(/\b(spremi|sprem|odaberi|nespremljen)/i);
  });
});
