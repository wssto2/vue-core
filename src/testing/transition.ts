import { Comment, defineComponent } from "vue";

/**
 * A `<transition>` stand-in whose leave ends `afterMs` after its content went away, so a test can
 * act during a leave transition (test-utils' stub never ends one, real ones end in a frame).
 * Not public; tests only.
 */
export function lateLeaveTransition(afterMs = 30) {
  return defineComponent({
    inheritAttrs: false,
    emits: ["after-leave"],
    setup(_, { slots, emit }) {
      let hadContent = false;
      return () => {
        const nodes = slots.default?.() ?? [];
        const hasContent = nodes.some((node) => node.type !== Comment);
        if (hadContent && !hasContent) setTimeout(() => emit("after-leave"), afterMs);
        hadContent = hasContent;
        return nodes;
      };
    },
  });
}
