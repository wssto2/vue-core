// Type fixtures, checked by `npm run typecheck`: the states are a union, tones are meanings.
import { h } from "vue";
import AsyncSection from "./AsyncSection.vue";
import Badge from "./Badge.vue";
import Banner from "./Banner.vue";
import type { AsyncState } from "./async";

// @ts-expect-error a failed state carries the error, a loaded one the value
export const noError: AsyncState<string[]> = { status: "failed" };
// @ts-expect-error loaded without a value
export const noValue: AsyncState<string[]> = { status: "loaded" };
// @ts-expect-error loading and failed cannot be combined
export const both: AsyncState<string[]> = { status: "loading", error: "x" };

h(Badge, { tone: "critical" });
// @ts-expect-error tones are meanings (positive, critical…), not colours or ARV's old names
h(Badge, { tone: "danger" });
// @ts-expect-error success is called positive
h(Banner, { tone: "success" });
// @ts-expect-error a colour is not a tone
h(Banner, { tone: "red" });

// The slot's value is the loaded value, non-null and typed from the state.
h(AsyncSection<string[]>, { state: { status: "loading" } }, { default: ({ value }: { value: string[] }) => value.join() });
