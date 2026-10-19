import { fireEvent, render, screen } from "@testing-library/vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { defineComponent, h, ref } from "vue";
import { createTestI18n, testFormatting } from "../../testing";
import VerifyCode from "./VerifyCode.vue";

const i18n = createTestI18n();
const NOW = new Date("2026-10-13T14:00:00Z");

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date", "setInterval", "clearInterval"] });
  vi.setSystemTime(NOW);
});
afterEach(() => {
  vi.useRealTimers();
  document.body.innerHTML = "";
});

const after = (seconds: number) => new Date(NOW.getTime() + seconds * 1000).toISOString();

/** The step with a code model of its own, as a dialog holds it. */
function mountStep(props: Record<string, unknown> = {}) {
  const events = { verify: [] as string[], resend: 0 };
  const code = ref("");
  const Host = defineComponent({
    setup: () => () =>
      h(VerifyCode, { modelValue: code.value, "onUpdate:modelValue": (value: string) => (code.value = value), ...props, onVerify: (typed: string) => events.verify.push(typed), onResend: () => events.resend++ }),
  });
  render(Host, { global: { plugins: [i18n, testFormatting(i18n)] } });
  return { events, code };
}

const resendButton = () => document.querySelector("[data-verify-resend]") as HTMLButtonElement;
const codeInput = () => document.querySelector("[data-test='otp-input-field']") as HTMLInputElement;

describe("the resend countdown", () => {
  it("counts down to zero while the step is open, and lets a resend through only then", async () => {
    const { events } = mountStep({ resendAvailableAt: after(125) });
    expect(resendButton().disabled).toBe(true);
    expect(resendButton().textContent?.trim()).toBe("Resend code in 2:05");

    await vi.advanceTimersByTimeAsync(5000);
    expect(resendButton().textContent?.trim()).toBe("Resend code in 2:00");
    await fireEvent.click(resendButton());
    expect(events.resend).toBe(0);

    await vi.advanceTimersByTimeAsync(120_000);
    expect(resendButton().disabled).toBe(false);
    expect(resendButton().textContent?.trim()).toBe("Resend code");
    await fireEvent.click(resendButton());
    expect(events.resend).toBe(1);
  });

  it("is open at once for a time that has passed or is missing", () => {
    mountStep({ resendAvailableAt: after(-5) });
    expect(resendButton().disabled).toBe(false);
    document.body.innerHTML = "";
    mountStep({ resendAvailableAt: null });
    expect(resendButton().disabled).toBe(false);
  });

  it("does not resend while a verification is running", async () => {
    const { events } = mountStep({ verifying: true });
    expect(resendButton().disabled).toBe(true);
    await fireEvent.click(resendButton());
    expect(events.resend).toBe(0);
  });
});

describe("the code's expiry", () => {
  it("shows when the code stops working, and the step is usable", () => {
    mountStep({ expiresAt: after(900) });
    expect(document.querySelector("[data-verify-expires]")?.textContent).toMatch(/\d{1,2}:\d{2}/);
    expect(document.querySelector("[data-verify-submit]")).not.toBeNull();
    expect(codeInput().disabled).toBe(false);
  });

  it("an expired code locks the boxes, drops Verify and makes a new code the main action", async () => {
    const { events } = mountStep({ expired: true, expiresAt: after(-60), error: "The code is no longer valid. Request a new one." });
    expect(codeInput().disabled).toBe(true);
    expect(document.querySelector("[data-verify-submit]")).toBeNull();
    expect(document.querySelector("[data-verify-expires]")).toBeNull();
    expect(screen.getByRole("alert").textContent).toBe("The code is no longer valid. Request a new one.");
    expect(resendButton().textContent?.trim()).toBe("Request a new code");
    await fireEvent.click(resendButton());
    expect(events.resend).toBe(1);
  });

  it("never sends a complete code once it expired", async () => {
    const { events } = mountStep({ expired: true });
    await fireEvent.submit(document.querySelector("[data-verify-code]")!);
    expect(events.verify).toEqual([]);
  });
});

describe("a wrong code", () => {
  it("sends the sixth digit once, and when the step is given the refusal it clears the boxes and says why", async () => {
    const error = ref("");
    const code = ref("");
    const verified: string[] = [];
    const Host = defineComponent({
      setup: () => () => h(VerifyCode, { modelValue: code.value, "onUpdate:modelValue": (value: string) => (code.value = value), error: error.value, onVerify: (typed: string) => verified.push(typed) }),
    });
    render(Host, { global: { plugins: [i18n, testFormatting(i18n)] } });

    for (const typed of ["1", "12", "123", "1234", "12345", "123456"]) await fireEvent.update(codeInput(), typed);
    expect(verified).toEqual(["123456"]);

    error.value = "The code is not correct. Attempts left: 2.";
    await vi.advanceTimersByTimeAsync(0);
    expect(code.value).toBe("");
    expect(screen.getByRole("alert").textContent).toBe("The code is not correct. Attempts left: 2.");
    expect(codeInput().getAttribute("aria-invalid")).toBe("true");
  });
});
