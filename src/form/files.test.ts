import { fireEvent, render, screen } from "@testing-library/vue";
import { afterEach, describe, expect, it, vi } from "vitest";
import { nextTick } from "vue";
import { testFormatting } from "../testing/format";
import { createTestI18n } from "../testing/i18n";
import { checkFile, formatBytes } from "./file";
import FileField from "./FileField.vue";
import PhotoField from "./PhotoField.vue";

const i18n = createTestI18n();
const global = { plugins: [i18n, testFormatting(i18n)] };

afterEach(() => {
  document.body.innerHTML = "";
  vi.restoreAllMocks();
});

const file = (name: string, type: string, size = 100) => new File([new Uint8Array(size)], name, { type });
const choose = async (input: HTMLInputElement, chosen: File) => {
  Object.defineProperty(input, "files", { value: [chosen], configurable: true });
  await fireEvent.change(input);
};

describe("checkFile", () => {
  it.each([
    ["a.pdf", "application/pdf", [".pdf"], null],
    ["A.PDF", "application/pdf", [".pdf"], null],
    ["a.png", "image/png", ["image/*"], null],
    ["a.png", "image/png", ["image/png"], null],
    ["a.png", "image/png", [".pdf"], "invalid_type"],
    ["noext", "", [".pdf"], "invalid_type"],
    ["a.gif", "image/gif", ["image/png", "image/jpeg"], "invalid_type"],
    ["a.anything", "x/y", [], null],
  ] as const)("%s (%s) against %j is %s", (name, type, accept, expected) => {
    expect(checkFile({ name, type, size: 1 }, { accept })).toBe(expected);
  });

  it("accepts a MIME family (ARV's check supported only exact types, so 'image/*' refused every image)", () => {
    expect(checkFile({ name: "x.webp", type: "image/webp", size: 1 }, { accept: ["image/*"] })).toBeNull();
  });

  it("limits the size when asked", () => {
    expect(checkFile({ name: "a", type: "", size: 11 }, { maxSize: 10 })).toBe("too_large");
    expect(checkFile({ name: "a", type: "", size: 10 }, { maxSize: 10 })).toBeNull();
    expect(checkFile({ name: "a", type: "", size: 10 ** 9 }, { maxSize: 0 })).toBeNull();
  });

  it("writes sizes for people", () => {
    expect([formatBytes(512), formatBytes(24 * 1024), formatBytes(5 * 1024 * 1024), formatBytes(1.5 * 1024 * 1024)]).toEqual(["512 B", "24 KB", "5 MB", "1.5 MB"]);
  });
});

describe("FileField", () => {
  it("keeps an acceptable file and shows its name and size; clearing removes it", async () => {
    const update = vi.fn();
    const { container, rerender } = render(FileField, { props: { modelValue: null, label: "Attachment", accept: [".pdf"], "onUpdate:modelValue": update }, global });
    expect(container.textContent).toContain("Allowed formats: PDF");
    await choose(screen.getByLabelText("Attachment") as HTMLInputElement, file("plan.pdf", "application/pdf", 2048));
    const chosen = update.mock.calls.at(-1)?.[0] as File;
    expect(chosen.name).toBe("plan.pdf");
    await rerender({ modelValue: chosen });
    expect(container.textContent).toContain("plan.pdf");
    expect(container.textContent).toContain("2 KB");
    await fireEvent.click(screen.getByRole("button", { name: "Remove" }));
    expect(update).toHaveBeenLastCalledWith(null);
  });

  it("refuses a file of the wrong type or size, says why, and keeps none", async () => {
    const update = vi.fn();
    render(FileField, { props: { modelValue: null, label: "Attachment", accept: [".pdf"], maxSize: 1024, "onUpdate:modelValue": update }, global });
    const input = screen.getByLabelText("Attachment") as HTMLInputElement;
    await choose(input, file("a.exe", "application/x-msdownload"));
    expect(screen.getByRole("alert").textContent).toContain("not supported");
    expect(update).not.toHaveBeenCalled();
    await choose(input, file("big.pdf", "application/pdf", 4096));
    expect(screen.getByRole("alert").textContent).toContain("larger than 1 KB");
    await choose(input, file("ok.pdf", "application/pdf", 10));
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("the dropzone takes a dropped file", async () => {
    const update = vi.fn();
    render(FileField, { props: { modelValue: null, label: "Sheet", variant: "dropzone", "onUpdate:modelValue": update }, global });
    await fireEvent.drop(screen.getByRole("button", { name: /Choose file/ }), { dataTransfer: { files: [file("data.csv", "text/csv")] } });
    expect((update.mock.calls.at(-1)?.[0] as File).name).toBe("data.csv");
  });

  it("shows the form's error when the file itself is fine", () => {
    render(FileField, { props: { modelValue: null, label: "Attachment", error: "Required" }, global });
    expect(screen.getByRole("alert").textContent).toContain("Required");
  });
});

describe("PhotoField", () => {
  it("previews a chosen picture, releases the preview when it is replaced and when the field goes away (ARV never revoked one)", async () => {
    let counter = 0;
    const create = vi.fn(() => `blob:preview-${++counter}`);
    const revoke = vi.fn();
    vi.stubGlobal("URL", Object.assign(URL, { createObjectURL: create, revokeObjectURL: revoke }));
    const first = file("a.png", "image/png");
    const { rerender, unmount } = render(PhotoField, { props: { modelValue: first, label: "Photo" }, global });
    expect(document.querySelector("[data-test='photo-preview']")?.getAttribute("src")).toBe("blob:preview-1");
    await rerender({ modelValue: file("b.png", "image/png") });
    await nextTick();
    expect(revoke).toHaveBeenCalledWith("blob:preview-1");
    expect(document.querySelector("[data-test='photo-preview']")?.getAttribute("src")).toBe("blob:preview-2");
    unmount();
    expect(revoke).toHaveBeenCalledWith("blob:preview-2");
    vi.unstubAllGlobals();
  });

  it("shows a picture the record already has by its URL, as an image, not as markup", () => {
    render(PhotoField, { props: { modelValue: 'https://x.test/a.png" onerror="alert(1)', label: "Photo" }, global });
    const image = document.querySelector("[data-test='photo-preview']") as HTMLImageElement;
    expect(image.getAttribute("src")).toBe('https://x.test/a.png" onerror="alert(1)');
    expect(image.getAttribute("onerror")).toBeNull();
  });

  it("opens the picture in the viewer when it is tapped, in the form and in read mode", async () => {
    const view = render(PhotoField, { props: { modelValue: "https://x.test/a.png", label: "Photo" }, global });
    expect(document.querySelector("[data-test='photo-viewer']")).toBeNull();
    await fireEvent.click(screen.getByRole("button", { name: "View photo" }));
    await nextTick();
    const viewer = document.querySelector("[data-test='photo-viewer']");
    expect(viewer?.querySelector("[data-test='photo']")?.getAttribute("src")).toBe("https://x.test/a.png");
    expect(viewer?.querySelector("[data-test='photo']")?.getAttribute("alt")).toBe("Photo");
    expect(viewer?.querySelector("[data-test='next']")).toBeNull(); // one picture: no arrows
    view.unmount();
    document.body.innerHTML = "";
    render(PhotoField, { props: { modelValue: "https://x.test/a.png", label: "Photo", editable: false }, global });
    await fireEvent.click(screen.getByRole("button", { name: "View photo" }));
    await nextTick();
    expect(document.querySelector("[data-test='photo-viewer']")).not.toBeNull();
  });

  it("refuses what is not a picture, and removes the one it has", async () => {
    const update = vi.fn();
    render(PhotoField, { props: { modelValue: "https://x.test/a.png", label: "Photo", "onUpdate:modelValue": update }, global });
    await choose(screen.getByLabelText("Photo") as HTMLInputElement, file("a.pdf", "application/pdf"));
    expect(screen.getByRole("alert").textContent).toContain("not supported");
    expect(update).not.toHaveBeenCalled();
    await fireEvent.click(screen.getByRole("button", { name: "Remove" }));
    expect(update).toHaveBeenLastCalledWith(null);
  });
});
