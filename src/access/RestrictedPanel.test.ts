import { fireEvent, render, screen } from "@testing-library/vue";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createTestApp } from "../testing";
import RestrictedPanel from "./RestrictedPanel.vue";

const mountPanel = async (props: Record<string, unknown> = {}, location = "/") => {
  const app = createTestApp({ location });
  await app.router.push(location);
  render(RestrictedPanel, { props, global: { plugins: [...app.plugins] } });
  return app;
};

afterEach(() => window.history.replaceState(null, ""));

describe("RestrictedPanel", () => {
  it("says the page is not open to the person, with the library's texts", async () => {
    await mountPanel();
    expect(screen.getByRole("heading", { name: "No access" })).toBeTruthy();
    expect(screen.getByText(/does not include this page/)).toBeTruthy();
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("names whom to write to when given a contact", async () => {
    await mountPanel({ contact: "admin@example.com" });
    const link = screen.getByRole("link", { name: "admin@example.com" });
    expect(link.getAttribute("href")).toBe("mailto:admin@example.com");
  });

  it("goes back in the app's own history when there is one", async () => {
    const app = await mountPanel();
    const back = vi.spyOn(app.router, "back");
    window.history.replaceState({ back: "/list" }, "");
    await fireEvent.click(screen.getByRole("button", { name: "Back to the previous page" }));
    expect(back).toHaveBeenCalledOnce();
  });

  it("goes home rather than out of the app when it was opened directly", async () => {
    const app = await mountPanel({ home: "/start" }, "/secret");
    const back = vi.spyOn(app.router, "back");
    await fireEvent.click(screen.getByRole("button", { name: "Back to the previous page" }));
    expect(back).not.toHaveBeenCalled();
    await vi.waitFor(() => expect(app.router.currentRoute.value.fullPath).toBe("/start"));
  });
});
