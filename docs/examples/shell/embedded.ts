import type { Application } from "@wssto2/vue-core/app";
import { modalPlacementKey } from "@wssto2/vue-core/modal";
import { useOpenDialogCount } from "@wssto2/vue-core/overlay";
import { ref, watch } from "vue";

/** How much of the frame the host page's own sidebar covers; the host tells the application (its message protocol is yours). */
export const hostSidebarWidth = ref(0);

/** For an application shown inside a frame of another page: two generic hooks, no protocol. Call it before `mount()`. */
export function installFrameHooks(application: Application, host: Window, hostOrigin: string) {
  // Dialogs stand near the top (a tall frame has no useful middle) and away from the host's sidebar.
  application.app.provide(modalPlacementKey, () => ({ align: "top", offsetX: -hostSidebarWidth.value / 2 }));

  // How many dialogs are open: the host can grow the frame or dim its own chrome while any is.
  const dialogs = useOpenDialogCount();
  watch(dialogs, (count) => host.postMessage({ type: "dialogs", count }, hostOrigin));
}
