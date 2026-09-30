import { onBeforeUnmount, onMounted, toValue, watch, type MaybeRefOrGetter, type Ref } from "vue";
import { useOptionalPageChrome } from "./chrome";

/**
 * Publishes a page's large title to the page chrome, so the phone nav bar can show it once the
 * title element has scrolled under the bar (iOS large titles). Does nothing when the app installed
 * no page chrome, and when `enabled` is false.
 */
export function useLargeTitle(element: Ref<HTMLElement | null>, title: MaybeRefOrGetter<string>, enabled: MaybeRefOrGetter<boolean> = true) {
  const chrome = useOptionalPageChrome();
  if (!chrome || !toValue(enabled)) return;

  const owner = chrome.claim();
  let observer: IntersectionObserver | null = null;

  watch(() => toValue(title), (value) => owner.setTitle(value), { immediate: true });

  onMounted(() => {
    if (!element.value || typeof IntersectionObserver === "undefined") return;

    // The bar is --app-bar-height tall (44 px on phones): the title counts as gone once it is under it.
    observer = new IntersectionObserver(([entry]) => owner.setTitleInView(entry?.isIntersecting ?? true), { rootMargin: "-52px 0px 0px 0px" });
    observer.observe(element.value);
  });

  onBeforeUnmount(() => {
    observer?.disconnect();
    owner.clearTitle();
  });
}
