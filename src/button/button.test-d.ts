// Type fixtures, checked by `npm run typecheck`: a misused Button is a compile error.
import { h } from "vue";
import Button from "./Button.vue";

h(Button, { prominence: "primary", tone: "critical", icon: "save" });

// @ts-expect-error a prominence nobody defined
h(Button, { prominence: "loud" });

// @ts-expect-error tone is a semantic meaning, not a colour
h(Button, { tone: "red" });

// @ts-expect-error an unknown icon name
h(Button, { icon: "noSuchIcon" });

// @ts-expect-error sizes are a union
h(Button, { size: "huge" });
