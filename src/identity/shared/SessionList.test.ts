import { render } from "@testing-library/vue";
import { describe, expect, it } from "vitest";
import type { SessionItem } from "../../modules/identity/entities";
import { createTestI18n, testFormatting } from "../../testing";
import SessionList from "./SessionList.vue";

const session = { id: "s1", device: "Chrome · Linux", ip: "127.0.0.1", current: false, last_used_at: "2026-10-13T09:32:00Z", expires_at: "2026-10-14T09:32:00Z", opened_by: null } as unknown as SessionItem;

describe("a session row on a narrow screen", () => {
  it("stacks its facts one per line, with separators only from the md breakpoint, and keeps Sign out under them", () => {
    const i18n = createTestI18n();
    const { container } = render(SessionList, { props: { sessions: [session], canEnd: true }, global: { plugins: [i18n, testFormatting(i18n)] } });
    const facts = container.querySelector("[data-session-facts]")!;
    expect(facts.className).toContain("flex-col");
    expect(facts.className).toContain("md:flex-row");
    const separators = [...facts.querySelectorAll("[aria-hidden]")];
    expect(separators).toHaveLength(2);
    for (const separator of separators) expect(separator.className).toContain("hidden md:inline"); // no separator can start or end a line below md
    const end = container.querySelector("[data-end-session]")!;
    expect(end.closest("[data-session]")).not.toBeNull();
    expect(facts.compareDocumentPosition(end) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(facts.contains(end)).toBe(false);
  });
});
