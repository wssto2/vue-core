// A Deactivate dialog that sends the application's hand-over plan as `details` (the server's deactivation hook reads it).
// It keeps the contract of `replace.deactivate`: the props of `DeactivateDialogProps`, an `open()` the record page calls,
// and a `done` event after it deactivated.
import { identityRoutes, usersFeature, type DeactivateDialogEmits, type DeactivateDialogProps } from "@wssto2/vue-core/identity";
import { usePlatform } from "@wssto2/vue-core/platform";
import { defineComponent, h, ref } from "vue";

const Deactivate = defineComponent(
  (props: DeactivateDialogProps, { emit, expose }: { emit: <E extends keyof DeactivateDialogEmits>(event: E) => void; expose: (exposed: { open(): void }) => void }) => {
    const { http } = usePlatform();
    const shown = ref(false);
    expose({ open: () => (shown.value = true) });
    const run = async () => {
      await http.request(identityRoutes.usersDeactivate, { id: props.id, details: { handOver: { leads: 5 } } });
      emit("done");
    };
    return () => (shown.value ? h("button", { onClick: run }, `Hand over ${props.name}`) : null);
  },
  { props: { id: { type: Number, required: true }, name: { type: String, required: true }, sessionCount: { type: Number, default: null } }, emits: ["done"] },
);

export const withDeactivate = usersFeature({ replace: { deactivate: Deactivate } });
