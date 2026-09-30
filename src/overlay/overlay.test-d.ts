// Type fixtures, checked by `npm run typecheck`: overlays are named, toned and stated by unions.
import { h } from "vue";
import Modal from "../modal/Modal.vue";
import AlertDialog from "./AlertDialog.vue";
import Menu, { type MenuItem } from "./Menu.vue";
import Popover from "./Popover.vue";

h(Popover, { label: "Filter" });
// @ts-expect-error a popover is a dialog and needs an accessible name
h(Popover, {});

h(AlertDialog<{ id: number }>, { title: "t", tone: "critical", action: (row: { id: number }) => void row.id });
// @ts-expect-error tones are neutral, warning and critical; not ARV's destructive
h(AlertDialog, { title: "t", tone: "destructive" });
// @ts-expect-error the presentation is a union
h(AlertDialog, { title: "t", presentation: "popup" });

h(Modal, { status: "processing", size: "md" });
// @ts-expect-error a status, not two booleans that can contradict each other
export const two: InstanceType<typeof Modal>["$props"] = { processing: true };
// @ts-expect-error sizes are a union
h(Modal, { size: "huge" });

export const item: MenuItem = { id: "a", label: "A", tone: "critical", onSelect: () => {} };
// @ts-expect-error a critical command is a tone, not a boolean
export const old: MenuItem = { id: "a", label: "A", destructive: true, onSelect: () => {} };

h(Menu, { items: [item], label: "Actions" });
