import { fireEvent, render } from "@testing-library/vue";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { defineComponent, nextTick, ref, type Component } from "vue";
import { createTestI18n } from "../testing/i18n";
import PhotoViewer, { type PhotoViewerItem } from "./PhotoViewer.vue";

const global = { plugins: [createTestI18n()], stubs: { transition: false as boolean | Component } };
const items: PhotoViewerItem[] = [
  { src: "/one.jpg", alt: "Front", downloadName: "front.jpg" },
  { src: "/two.jpg", thumb: "/two-small.jpg", alt: "Side" },
  { src: "/three.jpg", alt: "Rear" },
];

// A DOM has no layout: the stage is 800 × 500 and every photograph 1600 × 1000, so 100 % is 800 × 500.
const sizes = { client: [Object.getOwnPropertyDescriptor(HTMLElement.prototype, "clientWidth"), Object.getOwnPropertyDescriptor(HTMLElement.prototype, "clientHeight")] };
beforeEach(() => {
  Object.defineProperty(HTMLElement.prototype, "clientWidth", { configurable: true, get: () => 800 });
  Object.defineProperty(HTMLElement.prototype, "clientHeight", { configurable: true, get: () => 500 });
  Object.defineProperty(HTMLImageElement.prototype, "naturalWidth", { configurable: true, get: () => 1600 });
  Object.defineProperty(HTMLImageElement.prototype, "naturalHeight", { configurable: true, get: () => 1000 });
});
afterEach(() => {
  document.body.innerHTML = "";
  if (sizes.client[0]) Object.defineProperty(HTMLElement.prototype, "clientWidth", sizes.client[0]);
});

const settle = async () => {
  await nextTick();
  await nextTick();
  await nextTick();
};
// A leave transition ends on a frame.
const closed = () => new Promise((resolve) => setTimeout(resolve, 50));

function mount(list: PhotoViewerItem[] = items) {
  const viewer = ref<InstanceType<typeof PhotoViewer> | null>(null);
  const Owner = defineComponent({
    components: { PhotoViewer },
    setup: () => ({ viewer, list }),
    template: `<div><button id="trigger">Open</button><PhotoViewer ref="viewer" :items="list" title="VW Golf 8" /></div>`,
  });
  render(Owner, { global });
  return viewer;
}

const q = <T extends Element = HTMLElement>(test: string) => document.querySelector<T>(`[data-test="${test}"]`);
const press = (key: string) => q("photo-viewer")!.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));
const imageStyle = () => q<HTMLImageElement>("photo")!.style;

async function open(at = 0, list: PhotoViewerItem[] = items) {
  const viewer = mount(list);
  document.querySelector<HTMLElement>("#trigger")!.focus();
  viewer.value!.present(at);
  await settle();
  return viewer;
}

describe("presenting", () => {
  it("opens on the chosen photo with title and counter, and focuses the dialog", async () => {
    await open(1);
    expect(q("photo-counter")!.textContent).toBe("2 / 3");
    expect(q("photo-viewer")!.querySelector("h2")!.textContent).toContain("VW Golf 8");
    expect(q<HTMLImageElement>("photo")!.getAttribute("src")).toBe("/two.jpg");
    expect(q("photo-viewer")!.getAttribute("role")).toBe("dialog");
    expect(document.activeElement).toBe(q("photo-viewer"));
  });

  it("dismiss() closes it and focus goes back to what opened it", async () => {
    const viewer = await open();
    await viewer.value!.dismiss();
    await closed();
    expect(q("photo-viewer")).toBeNull();
    expect(document.activeElement?.id).toBe("trigger");
  });

  it("Escape closes it", async () => {
    await open();
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
    await closed();
    expect(q("photo-viewer")).toBeNull();
  });

  it("keeps Tab inside", async () => {
    await open();
    const buttons = [...q("photo-viewer")!.querySelectorAll<HTMLElement>("button, a[href]")];
    buttons.at(-1)!.focus();
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true }));
    expect(q("photo-viewer")!.contains(document.activeElement)).toBe(true);
  });

  it("clamps an index outside the list", async () => {
    await open(9);
    expect(q("photo-counter")!.textContent).toBe("3 / 3");
  });

  it("closes itself when the last photo is removed", async () => {
    const list = ref([...items]);
    const viewer = ref<InstanceType<typeof PhotoViewer> | null>(null);
    render(defineComponent({ components: { PhotoViewer }, setup: () => ({ viewer, list }), template: `<PhotoViewer ref="viewer" :items="list" />` }), { global });
    viewer.value!.present(0);
    await settle();
    list.value = [];
    await closed();
    expect(q("photo-viewer")).toBeNull();
  });
});

describe("moving between photos", () => {
  it("steps with the buttons and the arrow keys, and stops at the ends", async () => {
    await open();
    await fireEvent.click(q("next")!);
    expect(q("photo-counter")!.textContent).toBe("2 / 3");
    press("ArrowRight");
    await nextTick();
    expect(q("photo-counter")!.textContent).toBe("3 / 3");
    press("ArrowRight");
    await nextTick();
    expect(q("photo-counter")!.textContent).toBe("3 / 3");
    expect(q("next")!.getAttribute("aria-disabled")).toBe("true");
    press("ArrowLeft");
    await nextTick();
    expect(q("photo-counter")!.textContent).toBe("2 / 3");
  });

  it("chooses from the strip, which names each photo and uses the thumbnail", async () => {
    await open();
    const thumbs = [...document.querySelectorAll<HTMLElement>('[data-test="thumbnail"]')];
    expect(thumbs.map((thumb) => thumb.getAttribute("aria-label"))).toEqual(["Front", "Side", "Rear"]);
    expect(thumbs[1]!.querySelector("img")!.getAttribute("src")).toBe("/two-small.jpg");
    expect(thumbs[0]!.getAttribute("aria-current")).toBe("true");
    await fireEvent.click(thumbs[2]!);
    expect(q("photo-counter")!.textContent).toBe("3 / 3");
  });

  it("a single photo has neither arrows nor strip", async () => {
    await open(0, [items[0]!]);
    expect(q("next")).toBeNull();
    expect(q("photo-strip")).toBeNull();
  });

  it("offers a download with the suggested name", async () => {
    await open();
    const link = q<HTMLAnchorElement>("download")!;
    expect(link.getAttribute("href")).toBe("/one.jpg");
    expect(link.getAttribute("download")).toBe("front.jpg");
  });
});

describe("zoom", () => {
  it("zooms with the buttons and keys, shows the percentage and resets with 0", async () => {
    await open();
    expect(q("zoom-percent")!.textContent).toBe("100%");
    await fireEvent.click(q("zoom-in")!);
    expect(q("zoom-percent")!.textContent).toBe("150%");
    press("+");
    await nextTick();
    expect(q("zoom-percent")!.textContent).toBe("200%");
    press("-");
    await nextTick();
    expect(q("zoom-percent")!.textContent).toBe("150%");
    press("=");
    press("0");
    await nextTick();
    expect(q("zoom-percent")!.textContent).toBe("100%");
    expect(imageStyle().transform).toContain("scale(1)");
  });

  it("stops at 500 % and shows the mini-map only while zoomed in", async () => {
    await open();
    expect(q("mini-map")).toBeNull();
    for (let i = 0; i < 8; i++) press("+");
    await nextTick();
    expect(q("zoom-percent")!.textContent).toBe("500%");
    expect(q("zoom-in")!.getAttribute("aria-disabled")).toBe("true");
    expect(q("mini-map")).not.toBeNull();
    // 1/5 of the photo is in view, centred: the frame is a fifth of the 120 px map.
    expect(parseFloat(q("mini-map-view")!.style.width)).toBeCloseTo(24);
  });

  it("wheel zooms around the pointer and never below 100 %", async () => {
    await open();
    await fireEvent.wheel(q("photo-stage")!, { deltaY: -400 });
    expect(Number(/scale\(([\d.]+)\)/.exec(imageStyle().transform)![1])).toBeGreaterThan(1.5);
    await fireEvent.wheel(q("photo-stage")!, { deltaY: 4000 });
    expect(q("zoom-percent")!.textContent).toBe("100%");
  });

  it("zoom resets for the next photo", async () => {
    await open();
    press("+");
    press("ArrowRight");
    await nextTick();
    expect(q("zoom-percent")!.textContent).toBe("100%");
  });

  it("double tap zooms to 200 % and again back", async () => {
    await open();
    const stage = q("photo-stage")!;
    const tap = async () => {
      await fireEvent.pointerDown(stage, { pointerId: 1, clientX: 10, clientY: 10, button: 0 });
      await fireEvent.pointerUp(stage, { pointerId: 1, clientX: 10, clientY: 10 });
    };
    await tap();
    await tap();
    expect(q("zoom-percent")!.textContent).toBe("200%");
    await tap();
    await tap();
    expect(q("zoom-percent")!.textContent).toBe("100%");
  });

  it("pinching two fingers apart zooms by the change of their distance", async () => {
    await open();
    const stage = q("photo-stage")!;
    await fireEvent.pointerDown(stage, { pointerId: 1, clientX: 300, clientY: 100, button: 0 });
    await fireEvent.pointerDown(stage, { pointerId: 2, clientX: 500, clientY: 100, button: 0 });
    await fireEvent.pointerMove(stage, { pointerId: 2, clientX: 700, clientY: 100 });
    expect(q("zoom-percent")!.textContent).toBe("200%");
    await fireEvent.pointerUp(stage, { pointerId: 2, clientX: 700, clientY: 100 });
    await fireEvent.pointerUp(stage, { pointerId: 1, clientX: 300, clientY: 100 });
    expect(q("photo-counter")!.textContent).toBe("1 / 3"); // a pinch is never a swipe
  });

  it("rotates a quarter turn counter-clockwise per press", async () => {
    await open();
    await fireEvent.click(q("rotate")!);
    expect(imageStyle().transform).toContain("rotate(270deg)");
    // Turned, the 1600 × 1000 photo is 1000 × 1600 and fits the 500 px tall stage as a 312.5 × 500 picture: drawn 500 × 312.5, then rotated.
    expect(parseFloat(imageStyle().width)).toBeCloseTo(500);
    expect(parseFloat(imageStyle().height)).toBeCloseTo(312.5);
    press("r");
    await nextTick();
    expect(imageStyle().transform).toContain("rotate(180deg)");
  });
});

describe("dragging and swiping", () => {
  const drag = async (stage: HTMLElement, from: number, to: number) => {
    await fireEvent.pointerDown(stage, { pointerId: 1, clientX: from, clientY: 100, button: 0 });
    await fireEvent.pointerMove(stage, { pointerId: 1, clientX: (from + to) / 2, clientY: 100 });
    await fireEvent.pointerMove(stage, { pointerId: 1, clientX: to, clientY: 100 });
    await fireEvent.pointerUp(stage, { pointerId: 1, clientX: to, clientY: 100 });
  };

  it("a swipe left goes to the next photo and a swipe right to the previous", async () => {
    await open(1);
    await drag(q("photo-stage")!, 500, 300);
    expect(q("photo-counter")!.textContent).toBe("3 / 3");
    await drag(q("photo-stage")!, 300, 500);
    expect(q("photo-counter")!.textContent).toBe("2 / 3");
  });

  it("a short slow drag springs back", async () => {
    await open(1);
    const stage = q("photo-stage")!;
    await fireEvent.pointerDown(stage, { pointerId: 1, clientX: 500, clientY: 100, button: 0 });
    await fireEvent.pointerMove(stage, { pointerId: 1, clientX: 490, clientY: 100 });
    await new Promise((resolve) => setTimeout(resolve, 300));
    await fireEvent.pointerUp(stage, { pointerId: 1, clientX: 490, clientY: 100 });
    expect(q("photo-counter")!.textContent).toBe("2 / 3");
    expect(imageStyle().transform).toContain("translate(0px, 0px)");
  });

  it("a swipe past the last photo stays", async () => {
    await open(2);
    await drag(q("photo-stage")!, 500, 200);
    expect(q("photo-counter")!.textContent).toBe("3 / 3");
  });

  it("zoomed in, a drag moves the photo inside its bounds instead of changing photo", async () => {
    await open(1);
    press("+");
    press("+"); // 200 %: the photo overflows by 400 px each way on x
    await nextTick();
    await drag(q("photo-stage")!, 300, 900);
    expect(q("photo-counter")!.textContent).toBe("2 / 3");
    expect(imageStyle().transform).toContain("translate(400px, 0px)");
    expect(parseFloat(q("mini-map-view")!.style.left)).toBeCloseTo(0);
  });
});
