import { fireEvent, render, screen } from "@testing-library/vue";
import { describe, expect, it } from "vitest";
import PhotoViewerAction from "./PhotoViewerAction.vue";

describe("PhotoViewerAction", () => {
  it("is a button with its label that emits select when pressed", async () => {
    const { emitted } = render(PhotoViewerAction, { props: { label: "Make cover" } });
    const button = screen.getByRole("button", { name: "Make cover" });
    expect(button.getAttribute("type")).toBe("button");
    await fireEvent.click(button);
    expect(emitted().select).toHaveLength(1);
  });

  it("critical is the danger colour, the default is not", () => {
    render(PhotoViewerAction, { props: { label: "Delete", tone: "critical" } });
    render(PhotoViewerAction, { props: { label: "Cover" } });
    expect(screen.getByText("Delete").className).toContain("text-[#ff8a80]");
    expect(screen.getByText("Cover").className).not.toContain("text-[#ff8a80]");
  });

  it("disabled says so, stays focusable and emits nothing", async () => {
    const { emitted } = render(PhotoViewerAction, { props: { label: "Delete", disabled: true } });
    const button = screen.getByRole("button", { name: "Delete" });
    expect(button.getAttribute("aria-disabled")).toBe("true");
    await fireEvent.click(button);
    expect(emitted().select).toBeUndefined();
  });

  it("has a 44 px touch target", () => {
    render(PhotoViewerAction, { props: { label: "Cover" } });
    expect(screen.getByText("Cover").className).toContain("min-h-11");
  });
});
