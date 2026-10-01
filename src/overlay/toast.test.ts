import { fireEvent, render, screen } from "@testing-library/vue";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createTestI18n } from "../testing/i18n";
import Toaster from "./Toaster.vue";
import { toast } from "./toast";

afterEach(() => {
  toast.dismiss();
  document.body.innerHTML = "";
});

describe("toast and Toaster", () => {
  it("shows a message in the Toaster, in a region named in the active locale", async () => {
    const { container } = render(Toaster, { global: { plugins: [createTestI18n({ locale: "hr" })] } });
    toast.success("Spremljeno");

    await vi.waitFor(() => expect(container.textContent ?? document.body.textContent).toContain("Spremljeno"));
    expect(document.body.querySelector("section[aria-label]")?.getAttribute("aria-label")).toContain("Obavijesti");
  });

  it("carries an action (Undo, Retry) that runs its handler", async () => {
    render(Toaster, { global: { plugins: [createTestI18n()] } });
    const undo = vi.fn();
    toast.error("Could not save", { action: { label: "Retry", onClick: undo } });

    await fireEvent.click(await screen.findByRole("button", { name: "Retry" }));
    expect(undo).toHaveBeenCalledTimes(1);
  });

  it("a loading toast is dismissed by its id", async () => {
    render(Toaster, { global: { plugins: [createTestI18n()] } });
    const id = toast.loading("Deleting…");
    await screen.findByText("Deleting…");

    toast.dismiss(id);
    await vi.waitFor(() => expect(screen.queryByText("Deleting…")).toBeNull());
  });
});
