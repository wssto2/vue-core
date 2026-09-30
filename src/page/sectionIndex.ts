import { getCurrentScope, inject, nextTick, onBeforeUnmount, onMounted, onScopeDispose, provide, ref, shallowRef, watch, type InjectionKey, type Ref, type ShallowRef } from "vue";
import { routerKey } from "vue-router";

/** One jump target of a long page: a titled region the section list links to. */
export interface IndexedSection {
  /** The anchor: also the URL fragment (`#identification`), so a shared link lands on the section. */
  readonly id: string;
  readonly label: string;
  /** Shown before the label ("02"). */
  readonly number?: string;
  readonly element: HTMLElement;
  /** Makes the section's content visible before it is scrolled to, e.g. expands a collapsed panel. */
  readonly reveal?: () => void;
}

/**
 * The sections of a long record page, for jumping to them and showing which one is in view. The
 * page (or `SectionNavigator`) provides one; `SectionPanel` registers into it, `SectionList` and
 * `SectionJumper` read it.
 */
export interface SectionIndex {
  /** Registered sections in document order. */
  readonly sections: Readonly<ShallowRef<readonly IndexedSection[]>>;
  /** The section at the top of the viewport (scroll spy). */
  readonly activeId: Readonly<Ref<string | null>>;
  /** Registers a section until the returned function is called. Two sections with one id is a mistake and throws. */
  register(section: IndexedSection): () => void;
  update(id: string, patch: Partial<Pick<IndexedSection, "label" | "number">>): void;
  /** Scrolls to a section (revealing it first), moves focus there and writes its id to the URL fragment unless `updateUrl` is false. */
  scrollTo(id: string, options?: { readonly updateUrl?: boolean }): Promise<void>;
}

const sectionIndexKey: InjectionKey<SectionIndex> = Symbol("vue-core.sectionIndex");

/** A section counts as current once its top has passed this far below the top of the viewport: about where a reader's eye lands after a jump. */
const SPY_OFFSET = 120;

const byDocumentOrder = (a: IndexedSection, b: IndexedSection) => (a.element.compareDocumentPosition(b.element) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1);

const scrollBehavior = (): ScrollBehavior => (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth");

/** An anchor id from a title: `"Podaci o vozilu"` is `"podaci-o-vozilu"`. */
export function sectionId(title: string): string {
  return title
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/gi, "d")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Creates the section index of the calling component and provides it below. Needs a component (or
 * effect scope): its listeners end with it. Reads the router, when there is one, to keep the URL
 * fragment in step with the section jumped to and to follow a fragment the page was opened with.
 */
export function provideSectionIndex(): SectionIndex {
  const router = inject(routerKey, null);
  const sections = shallowRef<readonly IndexedSection[]>([]);
  const activeId = ref<string | null>(null);

  function spy() {
    const list = sections.value;
    if (list.length === 0) {
      activeId.value = null;
      return;
    }
    // At the very bottom a short last section can never reach the offset line.
    if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2) {
      activeId.value = list[list.length - 1]!.id;
      return;
    }
    let current = list[0]!.id;
    for (const section of list) if (section.element.getBoundingClientRect().top - SPY_OFFSET <= 0) current = section.id;
    activeId.value = current;
  }

  let frame = 0;
  const onScroll = () => {
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      spy();
    });
  };
  watch(
    () => sections.value.length > 0,
    (any) => {
      if (any) {
        window.addEventListener("scroll", onScroll, { passive: true });
        window.addEventListener("resize", onScroll, { passive: true });
      } else {
        window.removeEventListener("scroll", onScroll);
        window.removeEventListener("resize", onScroll);
      }
    },
  );
  if (getCurrentScope())
    onScopeDispose(() => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) cancelAnimationFrame(frame);
    });

  // The URL fragment: clicking a section writes it (no history entry per click); a page opened with one scrolls there once it exists.
  let honoured = "";
  const fragment = () => decodeURIComponent(router?.currentRoute.value.hash.slice(1) ?? "");
  function honourFragment() {
    const id = fragment();
    const key = `${router?.currentRoute.value.path}#${id}`;
    const section = id ? sections.value.find((each) => each.id === id) : undefined;
    if (!section || key === honoured) return;
    honoured = key;
    // Let the section's content, and everything above it, lay out first.
    requestAnimationFrame(() => void scrollTo(section.id, { updateUrl: false }));
  }
  if (router) watch(() => router.currentRoute.value.hash, honourFragment);

  async function scrollTo(id: string, options: { readonly updateUrl?: boolean } = {}) {
    const section = sections.value.find((each) => each.id === id);
    if (!section) return;
    activeId.value = id;
    if (options.updateUrl !== false && router && router.currentRoute.value.hash !== `#${id}`) {
      const { path, query } = router.currentRoute.value;
      honoured = `${path}#${id}`;
      void router.replace({ path, query, hash: `#${id}` });
    }
    section.reveal?.();
    await nextTick();
    section.element.scrollIntoView({ behavior: scrollBehavior(), block: "start" });
    // A programmatic focus continues tabbing after the section, as a skip link does.
    if (section.element.hasAttribute("tabindex")) section.element.focus({ preventScroll: true });
  }

  const index: SectionIndex = {
    sections,
    activeId,
    register(section) {
      if (sections.value.some((each) => each.id === section.id)) throw new Error(`Section "${section.id}" is registered twice: give one of the sections another id.`);
      sections.value = [...sections.value, section].sort(byDocumentOrder);
      spy();
      honourFragment();
      return () => {
        sections.value = sections.value.filter((each) => each.id !== section.id);
        spy();
      };
    },
    update(id, patch) {
      sections.value = sections.value.map((section) => (section.id === id ? { ...section, ...patch } : section));
    },
    scrollTo,
  };
  provide(sectionIndexKey, index);
  return index;
}

/** The nearest section index, or null outside one. */
export function useSectionIndex(): SectionIndex | null {
  return inject(sectionIndexKey, null);
}

/**
 * Registers the element as a section for as long as the calling component is mounted. `SectionPanel`
 * uses it; it is public for a region that is not a `Panel` (a card of your own). Does nothing outside a section index.
 */
export function useSectionAnchor(
  id: string,
  label: () => string,
  element: Readonly<Ref<HTMLElement | null>>,
  options: { readonly number?: () => string | undefined; readonly reveal?: () => void } = {},
): void {
  const index = useSectionIndex();
  if (!index) return;
  let unregister: (() => void) | null = null;
  onMounted(() => {
    if (element.value) unregister = index.register({ id, label: label(), number: options.number?.(), element: element.value, reveal: options.reveal });
  });
  watch([label, () => options.number?.()], ([nextLabel, nextNumber]) => index.update(id, { label: nextLabel, number: nextNumber }));
  onBeforeUnmount(() => unregister?.());
}
