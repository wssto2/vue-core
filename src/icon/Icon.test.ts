import { render } from "@testing-library/vue";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp, defineComponent, h, inject } from "vue";
import { iconSetKey, installIcons, provideIcons } from "./environment";
import Icon from "./Icon.vue";
import type { IconName } from "./index";

afterEach(() => vi.restoreAllMocks());

const provide = (icons: Record<string, string>) => ({ global: { provide: { [iconSetKey as symbol]: icons } } });
// An app's own names are not in the registry of the library's build.
const named = (name: string) => name as IconName;

describe("Icon", () => {
  it("draws a library icon, decorative by default", () => {
    const { container } = render(Icon, { props: { name: "close" } });
    const svg = container.querySelector("svg");

    expect(svg?.getAttribute("aria-hidden")).toBe("true");
    expect(svg?.getAttribute("width")).toBe("18");
    expect(svg?.getAttribute("height")).toBe("18");
    expect(svg?.querySelector("path")).not.toBeNull();
  });

  it("is an image with an accessible name when it has a label", () => {
    const { getByRole } = render(Icon, { props: { name: "close", label: "Close", size: 14 } });
    const image = getByRole("img", { name: "Close" });

    expect(image.getAttribute("width")).toBe("14");
    expect(image.hasAttribute("aria-hidden")).toBe(false);
  });

  it("takes classes from the call site", () => {
    const { container } = render(Icon, { props: { name: "close" }, attrs: { class: "text-content-muted" } });

    expect(container.querySelector("svg")?.getAttribute("class")).toContain("text-content-muted");
  });

  it("draws an icon from the app's set, and the app's set wins over the library's", () => {
    const app = render(Icon, {
      props: { name: named("carLine") },
      ...provide({ carLine: '<svg viewBox="0 0 24 24"><path id="car" d="M0 0"/></svg>' }),
    });
    expect(app.container.querySelector("#car")).not.toBeNull();

    const override = render(Icon, {
      props: { name: "close" },
      ...provide({ close: '<svg viewBox="0 0 24 24"><path id="mine" d="M0 0"/></svg>' }),
    });
    expect(override.container.querySelector("#mine")).not.toBeNull();
  });

  // arv-next SvgIcon rebuilt only the first level of the SVG and turned every text node (the
  // whitespace of a multi-line source included) into a <text> element.
  it("keeps nested elements and adds no text elements", () => {
    const { container } = render(Icon, {
      props: { name: named("nested") },
      ...provide({
        nested: `<svg viewBox="0 0 24 24">
          <g fill="none"><path id="inner" d="M0 0"/></g>
        </svg>`,
      }),
    });

    expect(container.querySelector("g > #inner")).not.toBeNull();
    expect(container.querySelector("text")).toBeNull();
  });

  it("reports an unknown name once and renders nothing", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const { container, rerender } = render(Icon, { props: { name: named("missing") } });

    expect(container.querySelector("svg")).toBeNull();
    return rerender({ size: 20 }).then(() => {
      expect(error).toHaveBeenCalledTimes(1);
      expect(String(error.mock.calls[0]?.[0])).toContain('"missing"');
    });
  });

  it("renders nothing for a source that is not an SVG", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { container } = render(Icon, { props: { name: named("broken") }, ...provide({ broken: "<div>no</div>" }) });

    expect(container.querySelector("svg")).toBeNull();
  });

  describe("partial sets", () => {
    const car = '<svg viewBox="0 0 24 24"><path id="car" d="M0 0"/></svg>';
    const user = '<svg viewBox="0 0 24 24"><path id="user" d="M0 0"/></svg>';
    const installed = (...sets: Record<string, string>[]) => {
      const app = createApp(defineComponent({ render: () => null }));
      installIcons(app, ...(sets as never[]));
      return app._context.provides[iconSetKey as symbol] as Record<string, string>;
    };

    it("merges the sets of several features", () => {
      expect(installed({ carLine: car }, { userLine: user })).toEqual({ carLine: car, userLine: user });
    });

    it("throws naming the icon and both sets when a name is in two", () => {
      expect(() => installed({ carLine: car }, { userLine: user }, { carLine: user })).toThrow(/"carLine".*#1 and #3/);
    });

    it("adds to the installed icons below the caller instead of replacing them", () => {
      let seen: Record<string, string> = {};
      const Child = defineComponent({ render() { seen = inject(iconSetKey as never, {}) as Record<string, string>; return null; } });
      const Parent = defineComponent({ setup() { provideIcons({ userLine: user } as never); return () => h(Child); } });
      const app = createApp(Parent);
      installIcons(app, { carLine: car } as never);
      app.mount(document.createElement("div"));

      expect(seen).toEqual({ carLine: car, userLine: user });
    });
  });
});
