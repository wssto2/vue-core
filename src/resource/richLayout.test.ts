import { fireEvent, render, screen } from "@testing-library/vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { defineComponent, h, ref, shallowRef } from "vue";
import { createMemoryHistory, createRouter, RouterView } from "vue-router";
import { ApiError } from "../client";
import { RecordHeader, SectionNavigator, AdaptivePageShell } from "../page";
import { pageSectionBackKey } from "../page/sectionBack";
import { createAccessClient, platformKey, type AccessSnapshot, type Platform } from "../platform";
import { accessOf } from "../platform/testing";
import { AppRouterView, createRouteAccess, routeAccessKey } from "../router/access";
import { AsyncSection } from "../state";
import { createTestI18n } from "../testing/i18n";
import { mockMedia } from "../testing/media";
import { useResource } from "./resource";
import { useRouteResource } from "./routeResource";

/**
 * A lead-like record composed directly from the page parts on the same resource state, as a rich
 * layout does (PLAN V6, §7.4): the lead is the route's resource, the phase history and the comments are
 * regions that load, fail and retry on their own, and the three columns keep their phone order.
 */
interface Lead {
  readonly id: number;
  readonly name: string;
}
interface Reads {
  lead: (id: number) => Promise<Lead>;
  history: (id: number) => Promise<string[]>;
  comments: (id: number) => Promise<string[]>;
}

const i18n = createTestI18n("en");
const settle = async () => {
  for (let index = 0; index < 6; index++) await new Promise((resolve) => setTimeout(resolve, 0));
};
const original = window.matchMedia;
let media: ReturnType<typeof mockMedia>;
beforeEach(() => {
  media = mockMedia();
});
afterEach(() => {
  media.restore();
  window.matchMedia = original;
  document.body.innerHTML = "";
});

function LeadPage(reads: Reads) {
  return defineComponent({
    setup() {
      const lead = useRouteResource({ param: "leadID", load: (id) => reads.lead(id) });
      const history = useResource({ for: () => lead.id.value, load: (id) => reads.history(id) });
      return () =>
        h(AdaptivePageShell, { title: lead.data.value?.name ?? "Lead" }, {
          header: () =>
            lead.state.value.status === "failed"
              ? h(AsyncSection, { state: lead.state.value, onRetry: () => void lead.reload() })
              : lead.data.value
                ? h(RecordHeader, { title: lead.data.value.name })
                : null,
          default: () => [
            h("div", { "data-region": "track" }, [
              h(AsyncSection, { state: history.state.value, skeletonRows: 1, onRetry: () => void history.reload() }, { default: ({ value }: { value: string[] }) => h("ol", value.map((phase) => h("li", phase))) }),
            ]),
            h("div", { class: "grid", "data-region": "columns" }, [
              lead.data.value ? h("aside", { class: "max-lg:order-2", "data-region": "aside" }, `aside of ${lead.data.value.name}`) : null,
              h(SectionNavigator, { label: "Sections", class: "max-lg:order-1", "data-region": "sections" }, { default: () => h(AppRouterView) }),
              lead.data.value ? h(Comments, { leadId: lead.data.value.id, read: reads.comments, class: "max-lg:order-3" }) : null,
            ]),
          ],
        });
    },
  });
}

const Comments = defineComponent({
  props: { leadId: { type: Number, required: true }, read: { type: Function, required: true } },
  setup(props) {
    const comments = useResource({ for: () => props.leadId, load: (id) => (props.read as Reads["comments"])(id) });
    return () =>
      h("section", { "data-region": "comments" }, [
        h(AsyncSection, { state: comments.state.value, onRetry: () => void comments.reload() }, { default: ({ value }: { value: string[] }) => h("ul", value.map((text) => h("li", text))) }),
      ]);
  },
});

async function openLead(reads: Reads, path = "/leads/5") {
  const snapshot = shallowRef<AccessSnapshot>(accessOf({}));
  const access = createAccessClient(() => snapshot.value);
  const Section = defineComponent({ render: () => h("p", { "data-section": "" }, "general") });
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      {
        path: "/leads/:leadID",
        component: LeadPage(reads),
        children: [
          { name: "lead.general", path: "general", component: Section, meta: { section: { labelKey: "core.sections.label", icon: "informationLine" } } },
          { name: "lead.history", path: "history", component: Section, meta: { section: { labelKey: "core.actions.more", icon: "box2Line" } } },
        ],
      },
    ],
  });
  await router.push(path);
  const routeAccess = createRouteAccess({ router, access, noAccess: defineComponent({ render: () => h("p", "no access") }) });
  const view = render(defineComponent({ render: () => h(RouterView) }), {
    global: { plugins: [router, i18n], provide: { [platformKey as symbol]: { access } as unknown as Platform, [routeAccessKey as symbol]: routeAccess, [pageSectionBackKey as symbol]: ref(null) } },
    container: document.body.appendChild(document.createElement("div")),
  });
  await settle();
  return { ...view, router };
}

const region = (name: string) => document.querySelector(`[data-region="${name}"]`);
const reads = (overrides: Partial<Reads> = {}): Reads => ({
  lead: async (id) => ({ id, name: `Lead ${id}` }),
  history: async (id) => [`received ${id}`, `contacted ${id}`],
  comments: async (id) => [`comment of ${id}`],
  ...overrides,
});

describe("a lead-like record on the same resource state", () => {
  it("loads the record and each region once, and renders every part", async () => {
    const all = { lead: vi.fn(reads().lead), history: vi.fn(reads().history), comments: vi.fn(reads().comments) };
    await openLead(all);
    expect([all.lead, all.history, all.comments].map((read) => read.mock.calls.length)).toEqual([1, 1, 1]);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Lead 5");
    expect(region("track")?.textContent).toContain("received 5");
    expect(region("aside")?.textContent).toBe("aside of Lead 5");
    expect(region("comments")?.textContent).toContain("comment of 5");
    expect(document.querySelector("[data-section]")?.textContent).toBe("general");
  });

  it("keeps the lead and the comments readable when the phase history fails, and retries only the history", async () => {
    let failing = true;
    const all = { lead: vi.fn(reads().lead), comments: vi.fn(reads().comments), history: vi.fn(async (id: number) => {
      if (failing) throw new ApiError({ kind: "server", message: "down", status: 500 });
      return [`received ${id}`];
    }) };
    await openLead(all);
    expect(region("track")?.querySelector("[data-async=failed]")).toBeTruthy();
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Lead 5");
    expect(region("aside")).toBeTruthy();
    expect(region("comments")?.textContent).toContain("comment of 5");

    failing = false;
    await fireEvent.click(region("track")!.querySelector("button")!);
    await settle();
    expect(region("track")?.textContent).toContain("received 5");
    expect([all.lead.mock.calls.length, all.comments.mock.calls.length, all.history.mock.calls.length]).toEqual([1, 1, 2]);
  });

  it("keeps the lead and the history when the comments fail, and retries only the comments", async () => {
    let failing = true;
    const all = { lead: vi.fn(reads().lead), history: vi.fn(reads().history), comments: vi.fn(async (id: number) => {
      if (failing) throw new Error("down");
      return [`comment of ${id}`];
    }) };
    await openLead(all);
    expect(region("comments")?.querySelector("[data-async=failed]")).toBeTruthy();
    expect(region("track")?.textContent).toContain("received 5");

    failing = false;
    await fireEvent.click(region("comments")!.querySelector("button")!);
    await settle();
    expect(region("comments")?.textContent).toContain("comment of 5");
    expect([all.lead.mock.calls.length, all.history.mock.calls.length, all.comments.mock.calls.length]).toEqual([1, 1, 2]);
  });

  it("shows the lead's own failure in the header and renders no region that needs the lead", async () => {
    await openLead(reads({ lead: async () => { throw new ApiError({ kind: "notFound", message: "no", status: 404 }); } }));
    expect(document.querySelector('[data-async="failed"]')).toBeTruthy();
    expect(region("aside")).toBeNull();
    expect(region("comments")).toBeNull();
  });

  it("follows the lead to the next one: every region clears and reads again, and a response for the lead that was left is dropped", async () => {
    let releaseFirst!: (value: string[]) => void;
    const slowFirst = new Promise<string[]>((resolve) => (releaseFirst = resolve));
    const page = await openLead(reads({ comments: (id) => (id === 5 ? slowFirst : Promise.resolve([`comment of ${id}`])) }));
    await page.router.push("/leads/6/general");
    await settle();
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Lead 6");
    expect(region("track")?.textContent).toContain("received 6");
    expect(region("comments")?.textContent).toContain("comment of 6");

    releaseFirst(["late comment of 5"]);
    await settle();
    expect(region("comments")?.textContent).not.toContain("late comment");
  });

  it("orders the regions for phones as the production screen does: sections, contact, comments", async () => {
    await openLead(reads());
    const columns = region("columns")!;
    const order = [...columns.children].map((child) => [(child as HTMLElement).dataset.region, child.className.match(/max-lg:order-(\d)/)?.[1]]);
    expect(order).toEqual([["aside", "2"], ["sections", "1"], ["comments", "3"]]);
  });

  it("has one section navigation and no second sidebar", async () => {
    await openLead(reads());
    expect(document.querySelectorAll('[data-test="section-navigator"]')).toHaveLength(1);
    expect(document.querySelectorAll('nav[aria-label="Sections"]')).toHaveLength(1);
    expect(document.querySelectorAll("aside")).toHaveLength(1); // the record's own contact column, not the navigator's
  });
});
