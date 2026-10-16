import { fireEvent, render, screen } from "@testing-library/vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestI18n } from "../testing/i18n";
import AndroidInstallBanner from "./AndroidInstallBanner.vue";
import { captureInstallPrompt } from "./install";
import InstallQrSheet from "./InstallQrSheet.vue";
import IosInstallGuide from "./IosInstallGuide.vue";
import QrCode from "./QrCode.vue";

const global = { plugins: [createTestI18n()] };

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("QrCode", () => {
  it("draws the modules of the value as one path on a white square, named by its label", () => {
    render(QrCode, { props: { value: "https://example.test", size: 100, label: "QR of the address" } });
    const svg = screen.getByRole("img", { name: "QR of the address" });

    expect(svg.getAttribute("width")).toBe("100");
    expect(svg.getAttribute("viewBox")).toMatch(/^0 0 (\d+) \1$/);
    expect(svg.querySelector("path")!.getAttribute("d")).toMatch(/^M\d+ \d+h1v1h-1z/);
  });

  it("draws another value differently", () => {
    const draw = (value: string) => {
      const { container, unmount } = render(QrCode, { props: { value, label: "x" } });
      const d = container.querySelector("path")!.getAttribute("d");
      unmount();
      return d;
    };
    expect(draw("https://a.example")).not.toBe(draw("https://b.example"));
  });
});

describe("AndroidInstallBanner", () => {
  beforeEach(() => {
    window.matchMedia = (() => ({ matches: false })) as unknown as typeof window.matchMedia;
  });

  it("names the application and closes on the close button", async () => {
    const { emitted } = render(AndroidInstallBanner, { props: { appName: "Helpdesk" }, global });

    expect(screen.getByText("Helpdesk as an app")).toBeTruthy();
    expect(screen.getByText("HEL")).toBeTruthy();
    await fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(emitted().close).toHaveLength(1);
  });

  it("closes after the system dialog was accepted, and stays open when it was dismissed", async () => {
    captureInstallPrompt();
    const prompt = (outcome: "accepted" | "dismissed") => {
      const event = new Event("beforeinstallprompt", { cancelable: true }) as Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
      event.prompt = async () => {};
      event.userChoice = Promise.resolve({ outcome });
      window.dispatchEvent(event);
    };
    const { emitted } = render(AndroidInstallBanner, { props: { appName: "Helpdesk", badge: "HD" }, global });
    expect(screen.getByText("HD")).toBeTruthy();

    prompt("dismissed");
    await fireEvent.click(screen.getByRole("button", { name: "Install" }));
    await vi.waitFor(() => expect(screen.getByRole("button", { name: "Install" }).hasAttribute("disabled")).toBe(false));
    expect(emitted().close).toBeUndefined();

    prompt("accepted");
    await fireEvent.click(screen.getByRole("button", { name: "Install" }));
    await vi.waitFor(() => expect(emitted().close).toHaveLength(1));
  });
});

describe("IosInstallGuide", () => {
  it("shows the three taps in turn, on its own and on Next, and stops its clock when it goes", async () => {
    vi.useFakeTimers();
    const { emitted, unmount } = render(IosInstallGuide, { props: { appName: "Helpdesk" }, global });

    expect(screen.getByText("Add Helpdesk to your home screen")).toBeTruthy();
    expect(screen.getByText("Tap ⋯ at the bottom right")).toBeTruthy();
    await vi.advanceTimersByTimeAsync(2800);
    expect(screen.getByText("Tap Share")).toBeTruthy();
    await fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByText("Choose Add to Home Screen")).toBeTruthy();
    await fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByText("Tap ⋯ at the bottom right")).toBeTruthy();

    await fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(emitted().close).toHaveLength(1);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe("InstallQrSheet", () => {
  it("presents the dialog when opened, with the code of the given address, and reports its dismissal", async () => {
    window.matchMedia = (() => ({ matches: false, addEventListener() {}, removeEventListener() {} })) as unknown as typeof window.matchMedia;
    const { rerender } = render(InstallQrSheet, { props: { appName: "Helpdesk", url: "https://helpdesk.test", open: false }, global });
    expect(screen.queryByRole("img", { name: "QR code of the address of Helpdesk" })).toBeNull();

    await rerender({ open: true });
    await vi.waitFor(() => expect(screen.getByRole("img", { name: "QR code of the address of Helpdesk" })).toBeTruthy());
    expect(screen.getByText("Helpdesk on your phone")).toBeTruthy();
  });
});
