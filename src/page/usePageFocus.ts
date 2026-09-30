import { onBeforeUnmount, onMounted, type Ref } from "vue";
import { useRoute } from "vue-router";
import type { PageChrome } from "./chrome";

/**
 * Remembers which link had focus and where the page was scrolled when the user leaves it, and gives
 * both back on return to the same URL (a list row, then back): session-only presentation memory in
 * the page chrome, bounded to 30 URLs. List data and query state stay with the collection. A saved
 * href also works when the rows arrive after the page mounted; any key or pointer press, or ten
 * seconds, ends the attempt.
 */
export function usePageFocus(root: Ref<HTMLElement | null>, chrome: PageChrome) {
  const route = useRoute();
  // The url of this page while it is shown: by the time the page unmounts the route has changed.
  const url = route.fullPath;
  let observer: MutationObserver | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;

  function stop() {
    observer?.disconnect();
    clearTimeout(timer);
    document.removeEventListener("pointerdown", stop, true);
    document.removeEventListener("keydown", stop, true);
  }

  onMounted(() => {
    const saved = chrome.focusMemory.take(url);
    if (!saved || !root.value) return;

    const restore = () => {
      const link = Array.from(root.value?.querySelectorAll<HTMLAnchorElement>("a[href]") ?? []).find(
        (element) => element.getAttribute("href") === saved.href,
      );
      if (!link) return;
      link.focus({ preventScroll: true });
      window.scrollTo({ top: saved.top, behavior: "instant" });
      stop();
    };
    observer = new MutationObserver(restore);
    observer.observe(root.value, { subtree: true, childList: true });
    document.addEventListener("pointerdown", stop, true);
    document.addEventListener("keydown", stop, true);
    timer = setTimeout(stop, 10_000);
    restore();
  });

  onBeforeUnmount(() => {
    // Leaving: the link the user followed still has focus while the page is being removed.
    const active = document.activeElement;
    if (active instanceof HTMLAnchorElement && root.value?.contains(active)) {
      chrome.focusMemory.put(url, { href: active.getAttribute("href") ?? "", top: window.scrollY });
    }
    stop();
  });
}
