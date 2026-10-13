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
const ids = (entries: ReturnType<typeof layoutProfile>["left"]) => entries.map((entry) => (entry.kind === "panel" ? entry.id : `+${entry.section.id}`));

describe("where the application's profile sections go", () => {
  it("keeps the built-in panels in their columns with no sections", () => {
    const layout = layoutProfile([], profile);
    expect([ids(layout.left), ids(layout.right), ids(layout.wide)]).toEqual([["details", "email"], ["password"], ["sessions", "signins"]]);
  });

  it("puts a section after or before a panel, in the panel's column, and at the end by default", () => {
    const layout = layoutProfile([section("phone", { after: "details" }), section("roles", { before: "password" }), section("prefs"), section("two", { after: "details" })], profile);
    expect(ids(layout.left)).toEqual(["details", "+phone", "+two", "email"]);
    expect(ids(layout.right)).toEqual(["+roles", "password"]);
    expect(ids(layout.wide)).toEqual(["sessions", "signins", "+prefs"]);
  });

  it("leaves out a section that is not visible for this person", () => {
    const layout = layoutProfile([section("hidden", { after: "email" }, (p) => p.id !== 1)], profile);
    expect(ids(layout.left)).toEqual(["details", "email"]);
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
    expect(document.querySelector("[data-profile-section='phone']")).not.toBeNull();
    expect(document.querySelector("[data-profile-section='secret']")).toBeNull();
    const left = document.querySelector("[data-profile-section='phone']")!.parentElement!;
    expect(left.firstElementChild).not.toBe(document.querySelector("[data-profile-section='phone']")); // after the details panel
  });
});
