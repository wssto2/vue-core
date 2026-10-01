import { fireEvent, render, screen } from "@testing-library/vue";
import { describe, expect, it } from "vitest";
import { defineComponent, h, ref } from "vue";
import { createTestI18n } from "../testing/i18n";
import AsyncSection from "./AsyncSection.vue";
import Badge from "./Badge.vue";
import Banner from "./Banner.vue";
import DrawnCheck from "./DrawnCheck.vue";
import EmptyState from "./EmptyState.vue";
import FieldNote from "./FieldNote.vue";
import ProgressTrack from "./ProgressTrack.vue";
import Skeleton from "./Skeleton.vue";
import StatusLine from "./StatusLine.vue";
import type { AsyncState } from "./async";

const global = { plugins: [createTestI18n()] };

describe("Badge", () => {
  it("is a label on the status surface of its tone with a hairline in the tone colour", () => {
    const { container } = render(Badge, { props: { tone: "warning", dot: true }, slots: { default: "Offer sent" } });
    const root = container.firstElementChild!;

    expect(root.className).toContain("rounded-md");
    expect(root.className).toContain("ring-current/20");
    expect(root.className).toContain("bg-status-warning-surface");
    expect(root.className).toContain("text-status-warning-content");
    expect(root.querySelector(".bg-status-warning-content")).not.toBeNull();
  });

  it("names its tones by meaning and keeps `context` for information that is not a state", () => {
    const classes = (tone: "neutral" | "info" | "positive" | "warning" | "critical" | "context") => {
      const { container, unmount } = render(Badge, { props: { tone }, slots: { default: "x" } });
      const value = container.firstElementChild!.className;
      unmount();
      return value;
    };

    expect(classes("positive")).toContain("bg-status-success-surface");
    expect(classes("critical")).toContain("bg-status-danger-surface");
    expect(classes("context")).toContain("bg-surface-cell");
  });

  it("hides its dot from assistive tech (the text carries the status)", () => {
    const { container } = render(Badge, { props: { dot: true }, slots: { default: "x" } });
    expect(container.querySelector("[aria-hidden='true']")).not.toBeNull();
  });
});

describe("Banner", () => {
  it("announces a critical banner as an alert and the others as a status", () => {
    const critical = render(Banner, { props: { tone: "critical" }, slots: { default: "Failed" } });
    expect(critical.getByRole("alert").textContent).toContain("Failed");
    critical.unmount();

    render(Banner, { props: { tone: "info" }, slots: { default: "FYI" } });
    expect(screen.getByRole("status").textContent).toContain("FYI");
  });

  it("uses the icon of its tone unless given another, and the status roles of its tone", () => {
    const { container } = render(Banner, { props: { tone: "warning" }, slots: { default: "x" } });
    expect(container.firstElementChild!.className).toContain("bg-status-warning-surface");
    expect(container.querySelector("svg path")?.getAttribute("d")).toContain("M10.29 3.86");
  });

  it("reads no legacy palette", () => {
    for (const tone of ["neutral", "info", "positive", "warning", "critical"] as const) {
      const { container, unmount } = render(Banner, { props: { tone }, slots: { default: "x" } });
      expect(container.innerHTML).not.toMatch(/(?:bg|text|border)-(?:gray|red|amber|blue|primary)-\d/);
      unmount();
    }
  });
});

describe("FieldNote", () => {
  it("is one line of guidance in its tone", () => {
    const { container } = render(FieldNote, { props: { tone: "warning" }, slots: { default: "Enter a price rule" } });
    expect(container.textContent).toContain("Enter a price rule");
    expect(container.firstElementChild!.className).toContain("text-status-warning-content");
  });
});

describe("EmptyState", () => {
  it("block: icon, title, description and the action slot", () => {
    const { container } = render(EmptyState, {
      props: { title: "No orders yet", description: "Add the first one" },
      slots: { actions: '<button>Add</button>' },
    });

    expect(container.textContent).toContain("No orders yet");
    expect(container.textContent).toContain("Add the first one");
    expect(screen.getByRole("button", { name: "Add" })).toBeTruthy();
    expect(container.querySelector("svg")).not.toBeNull();
  });

  it("inline: a single muted line, no icon", () => {
    const { container } = render(EmptyState, { props: { title: "Not entered", presentation: "inline" } });

    expect(container.textContent).toBe("Not entered");
    expect(container.querySelector("svg")).toBeNull();
  });
});

describe("Skeleton, DrawnCheck, ProgressTrack", () => {
  it("skeleton is decorative and pulses unless motion is reduced", () => {
    const { container } = render(Skeleton);
    const bar = container.firstElementChild!;
    expect(bar.getAttribute("aria-hidden")).toBe("true");
    expect(bar.className).toContain("animate-pulse");
    expect(bar.className).toContain("motion-reduce:animate-none");
  });

  it("skeleton carries no size utility of its own, so the caller's width and height apply", () => {
    const { container } = render(Skeleton, { attrs: { class: "h-10 w-2/3" } });
    const classes = container.firstElementChild!.className.split(/\s+/);
    expect(classes.filter((c) => /^(h|w)-/.test(c))).toEqual(["h-10", "w-2/3"]);
  });

  it("the drawn check is decorative and holds still under reduced motion", () => {
    const { container } = render(DrawnCheck, { props: { circle: true } });
    expect(container.querySelector("svg")!.getAttribute("aria-hidden")).toBe("true");
    expect(container.innerHTML).toContain("motion-reduce:animate-none");
  });

  it("progress never reaches 100 before it is done", async () => {
    const { rerender } = render(ProgressTrack, { props: { value: 100, label: "Searching" } });
    const track = screen.getByRole("progressbar", { name: "Searching" });
    expect(track.getAttribute("aria-valuenow")).toBe("95");

    await rerender({ done: true });
    expect(track.getAttribute("aria-valuenow")).toBe("100");
    expect((track.firstElementChild as HTMLElement).style.width).toBe("100%");
  });

  it("progress clamps below zero", () => {
    render(ProgressTrack, { props: { value: -10 } });
    expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe("0");
  });
});

describe("StatusLine", () => {
  it("announces its text politely, counting seconds once slow, with a way out in the slot", () => {
    render(StatusLine, { props: { text: "Searching…", elapsed: 7 }, slots: { default: "<a href='#'>Choose</a>" }, global });

    const line = screen.getByRole("status");
    expect(line.getAttribute("aria-live")).toBe("polite");
    expect(line.textContent).toContain("Searching…");
    expect(line.textContent).toContain("7 s");
    expect(screen.getByRole("link", { name: "Choose" })).toBeTruthy();
  });

  it("done: a check instead of the spinner and no shimmer", () => {
    const { container } = render(StatusLine, { props: { text: "Found", done: true }, global });

    expect(container.querySelector("[data-status-text]")!.className).not.toContain("text-shimmer");
    expect(container.querySelector(".animate-spin")).toBeNull();
  });
});

describe("AsyncSection", () => {
  const LOADED = '<template #default="{ value }"><p data-test="loaded">{{ value.join(",") }}</p></template>';
  const mount = (state: AsyncState<string[]>, extra: Record<string, unknown> = {}) => {
    const Owner = defineComponent({
      components: { AsyncSection },
      props: { state: { type: Object, required: true }, extra: { type: Object, default: () => ({}) } },
      emits: ["retry"],
      template: `<AsyncSection :state="state" v-bind="extra" @retry="$emit('retry')">${LOADED}<template #empty-actions><button>Add</button></template></AsyncSection>`,
    });
    return render(Owner, { props: { state, extra }, global });
  };

  it("loading: skeleton rows announced as busy, no content, no loading word", () => {
    const { container } = mount({ status: "loading" });
    const region = screen.getByRole("status", { busy: true });

    expect(region.getAttribute("aria-label")).toBe("Loading content");
    expect(container.querySelectorAll("[aria-hidden='true'].animate-pulse")).toHaveLength(3);
    expect(container.textContent).not.toMatch(/Loading/);
    expect(screen.queryByText(/./, { selector: "[data-test=loaded]" })).toBeNull();
  });

  it("loading: honours the skeleton row count", () => {
    const { container } = mount({ status: "loading" }, { skeletonRows: 6 });
    expect(container.querySelectorAll(".animate-pulse")).toHaveLength(6);
  });

  it("failed: an alert with the error and a retry that emits retry; no content", async () => {
    const { emitted } = mount({ status: "failed", error: "Boom" });

    expect(screen.getByRole("alert").textContent).toContain("Boom");
    expect(screen.queryByText("rows")).toBeNull();
    await fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(emitted().retry).toHaveLength(1);
  });

  it("loaded: the slot gets the value; empty shows the empty state with its action", () => {
    const loaded = mount({ status: "loaded", value: ["a", "b"] });
    expect(loaded.container.querySelector("[data-test=loaded]")!.textContent).toBe("a,b");
    loaded.unmount();

    const empty = mount({ status: "loaded", value: [] }, { emptyTitle: "No orders yet" });
    expect(empty.container.textContent).toContain("No orders yet");
    expect(screen.getByRole("button", { name: "Add" })).toBeTruthy();
    expect(empty.container.querySelector("[data-test=loaded]")).toBeNull();
  });

  it("empty: falls back to the shared title; a custom emptiness decides", () => {
    const fallback = mount({ status: "loaded", value: [] });
    expect(fallback.container.textContent).toContain("No data");
    fallback.unmount();

    const custom = mount({ status: "loaded", value: ["x"] }, { isEmpty: (value: string[]) => value.length < 2 });
    expect(custom.container.textContent).toContain("No data");
  });

  it("refreshing and stale keep the content; stale offers a retry, a stale failure shows the error", async () => {
    const refreshing = mount({ status: "refreshing", value: ["a"] });
    expect(refreshing.container.querySelector("[data-test=loaded]")).not.toBeNull();
    expect(refreshing.container.textContent).toContain("Refreshing");
    expect(screen.queryByRole("button", { name: "Try again" })).toBeNull();
    refreshing.unmount();

    const stale = mount({ status: "stale", value: ["a"] });
    expect(stale.container.textContent).toContain("may be out of date");
    await fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(stale.emitted().retry).toHaveLength(1);
    stale.unmount();

    const failedRefresh = mount({ status: "stale", value: ["a"], error: "Offline" });
    expect(screen.getByRole("alert").textContent).toContain("Offline");
    expect(failedRefresh.container.querySelector("[data-test=loaded]")).not.toBeNull();
  });

  it("keeps one content instance (DOM and input state) across refresh, stale failure and success", async () => {
    const Form = defineComponent({
      setup() {
        const value = ref("original");
        return () => h("input", { value: value.value, onInput: (event: Event) => (value.value = (event.target as HTMLInputElement).value) });
      },
    });
    const Owner = defineComponent({
      props: { state: { type: Object, required: true } },
      setup: (props) => () => h(AsyncSection as never, { state: props.state }, { default: () => h(Form) }),
    });
    const { container, rerender } = render(Owner, { props: { state: { status: "loaded", value: ["x"] } }, global });
    const input = container.querySelector("input")!;
    await fireEvent.update(input, "edited");

    for (const state of [
      { status: "refreshing", value: ["x"] },
      { status: "stale", value: ["x"], error: "Offline" },
      { status: "refreshing", value: ["x"] },
      { status: "loaded", value: ["x"] },
    ]) {
      await rerender({ state });
      expect(container.querySelector("input")).toBe(input);
      expect(input.value).toBe("edited");
    }
  });
});
