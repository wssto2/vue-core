import { fireEvent, render, screen } from "@testing-library/vue";
import { afterEach, describe, expect, it, vi } from "vitest";
import { defineComponent, nextTick, ref } from "vue";
import { createTestI18n } from "../testing/i18n";
import DiscardChangesModal from "./DiscardChangesModal.vue";

const i18n = createTestI18n();

function mountDiscard(handlers: Record<string, unknown> = {}) {
  const Owner = defineComponent({
    components: { DiscardChangesModal },
    setup: () => ({ discard: ref<{ present: () => void } | null>(null), handlers }),
    template: `<button id="go" @click="discard?.present()">go</button><DiscardChangesModal ref="discard" v-bind="handlers" />`,
  });
  return render(Owner, { global: { plugins: [i18n], stubs: { transition: false } } });
}

const open = async () => {
  await fireEvent.click(document.querySelector("#go")!);
  await nextTick();
  await nextTick();
};

afterEach(() => {
  document.body.innerHTML = "";
  document.body.className = "";
});

describe("DiscardChangesModal", () => {
  it("asks in the library's words, in the active locale", async () => {
    mountDiscard();
    await open();

    expect(screen.getByRole("alertdialog").textContent).toContain("Unsaved changes");
    expect(screen.getByRole("button", { name: "Discard changes" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Continue editing" })).toBeTruthy();
  });

  it("confirm: discard, then dismissed", async () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    const onDismissed = vi.fn();
    mountDiscard({ onConfirm, onCancel, onDismissed });
    await open();

    await fireEvent.click(screen.getByRole("button", { name: "Discard changes" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onCancel).not.toHaveBeenCalled();
    expect(onDismissed).toHaveBeenCalledTimes(1);
  });

  it("Continue editing and Escape keep the edit: cancel, then dismissed", async () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    mountDiscard({ onConfirm, onCancel });
    await open();

    await fireEvent.click(screen.getByRole("button", { name: "Continue editing" }));
    expect(onCancel).toHaveBeenCalledTimes(1);

    await open();
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
    expect(onCancel).toHaveBeenCalledTimes(2);
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
