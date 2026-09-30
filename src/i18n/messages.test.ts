import { describe, expect, it } from "vitest";
import { coreMessages } from "./index";

function paths(value: unknown, prefix = ""): string[] {
  if (typeof value !== "object" || value === null) return [prefix];
  return Object.entries(value).flatMap(([key, child]) => paths(child, prefix ? `${prefix}.${key}` : key));
}

describe("core messages", () => {
  const reference = paths(coreMessages.en).sort();

  it.each(["hr", "bs", "sl"] as const)("%s has exactly the keys of en", (locale) => {
    expect(paths(coreMessages[locale]).sort()).toEqual(reference);
  });

  it("has no empty text", () => {
    for (const messages of Object.values(coreMessages)) {
      const walk = (value: unknown): void => {
        if (typeof value === "string") expect(value.trim()).not.toBe("");
        else Object.values(value as object).forEach(walk);
      };
      walk(messages);
    }
  });
});
