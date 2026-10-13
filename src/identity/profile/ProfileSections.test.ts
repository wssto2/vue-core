import { screen } from "@testing-library/vue";
import { afterEach, describe, expect, it, vi } from "vitest";
import { defineComponent, h } from "vue";
import type { ProfileResponse } from "../../modules/identity/entities";
import { settle } from "../../testing";
import { dataOf, listOf, startScreen, stopApplications } from "../testing";
import { layoutProfile, type ProfileSection } from "./profileSections";

vi.setConfig({ testTimeout: 30_000 });
afterEach(stopApplications);

const profile = { id: 1, login: "ana", name: "Ana Anić", email: "ana@example.test", phone: "", locale: "en", created_at: "2026-09-01T08:00:00Z", pending_email: null } as ProfileResponse;
const section = (id: string, where: Pick<ProfileSection, "after" | "before"> = {}, visible?: ProfileSection["visible"]): ProfileSection => ({ id, component: defineComponent({ render: () => h("div", `mine-${id}`) }), visible, ...where }) as ProfileSection;
const ids = (entries: ReturnType<typeof layoutProfile>) => entries.map((entry) => (entry.kind === "panel" ? entry.id : `+${entry.section.id}`));

describe("where the application's profile sections go", () => {
  it("keeps the built-in groups in page order with no sections", () => {
    expect(ids(layoutProfile([], profile))).toEqual(["details", "email", "password", "sessions", "signins"]);
  });

  it("puts a section after or before a group, and at the end by default, keeping the given order", () => {
    const layout = layoutProfile([section("phone", { after: "details" }), section("roles", { before: "password" }), section("prefs"), section("two", { after: "details" })], profile);
    expect(ids(layout)).toEqual(["details", "+phone", "+two", "email", "+roles", "password", "sessions", "signins", "+prefs"]);
  });

  it("leaves out a section that is not visible for this person", () => {
    expect(ids(layoutProfile([section("hidden", { after: "email" }, (p) => p.id !== 1)], profile))).toEqual(["details", "email", "password", "sessions", "signins"]);
  });
});

describe("the profile page with the application's sections", () => {
  it("shows them where they were put, with the loaded profile, and hides the ones that opt out", async () => {
    const Phone = defineComponent({ props: { profile: { type: Object, required: true } }, render() { return h("section", { "data-phone": "" }, `phone of ${(this.profile as ProfileResponse).name}`); } });
    await startScreen({
      permissions: [],
      location: "/profile",
      users: { profileSections: [{ id: "phone", component: Phone, after: "details" }, section("secret", { after: "email" }, () => false)] },
      answers: { "GET /v1/iam/profile": dataOf(profile), "GET /v1/iam/profile/sessions": dataOf({ sessions: [] }), "GET /v1/iam/profile/signins": listOf([]) },
    });
    await settle();
    expect(await screen.findByText("phone of Ana Anić")).toBeTruthy();
    const mine = document.querySelector("[data-profile-section='phone']")!;
    expect(document.querySelector("[data-profile-section='secret']")).toBeNull();
    expect(mine.previousElementSibling?.querySelector("[data-test='form-group']") ?? mine.previousElementSibling).not.toBeNull(); // right after the details group
    expect(document.querySelector("[data-profile-email]")!.compareDocumentPosition(mine) & Node.DOCUMENT_POSITION_PRECEDING).toBeTruthy(); // and before e-mail
  });
});
