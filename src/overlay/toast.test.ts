import { fireEvent, render, screen } from "@testing-library/vue";
import { toast as sonner } from "vue-sonner";
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

  it("message is a plain toast with an action, and onDismiss gets the id when the user closes it", async () => {
    render(Toaster, { global: { plugins: [createTestI18n()] } });
    const spy = vi.spyOn(sonner, "message");
    const onDismiss = vi.fn();
    const undo = vi.fn();
    const id = toast.message("Filter deleted", { id: "f1", action: { label: "Undo", onClick: undo }, onDismiss });

    expect(id).toBe("f1");
    expect(spy).toHaveBeenCalledWith("Filter deleted", expect.objectContaining({ id: "f1", action: expect.anything() }));
    (spy.mock.calls[0]?.[1] as { onDismiss: (t: { id: string }) => void }).onDismiss({ id: "f1" });
    expect(onDismiss).toHaveBeenCalledWith("f1");

    await fireEvent.click(await screen.findByRole("button", { name: "Undo" }));
    expect(undo).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });
});
