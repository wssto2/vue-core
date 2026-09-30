<script lang="ts">
import { defineComponent, h, type PropType, type VNode } from "vue";
import { coreIcons } from "./core";
import { useIconSet } from "./environment";
import { parseSvg, type SvgNode } from "./parse";
import type { IconName, IconSize } from "./index";

function render(node: SvgNode, attrs: Record<string, unknown> = {}): VNode {
  return h(node.tag, { ...node.attrs, ...attrs }, node.children.map((child) => render(child)));
}

/**
 * One icon from the app's icon set (or the library's own), drawn in `currentColor`.
 * Decorative unless it has a `label`, which makes it an image with that accessible name.
 *
 *   <Icon name="close" />                               decorative, 18 px
 *   <Icon name="close" :size="14" :label="t('close')" /> an icon that is the only content of a button
 *
 * `name` is checked against the icons the app registered (see `IconRegistry`).
 */
export default defineComponent({
  name: "Icon",
  props: {
    name: { type: String as PropType<IconName>, required: true },
    size: { type: Number as PropType<IconSize>, default: 18 },
    label: { type: String, default: undefined },
  },
  setup(props) {
    const icons = useIconSet();
    let reported: string | null = null;

    return () => {
      const source = icons[props.name] ?? (coreIcons as Readonly<Record<string, string>>)[props.name];
      const svg = source === undefined ? null : parseSvg(source);

      if (!svg) {
        if (reported !== props.name) {
          reported = props.name;
          console.error(`[vue-core] Icon "${props.name}" is neither in the installed icon set (installIcons) nor a library icon.`);
        }
        return null;
      }

      return render(svg, {
        width: props.size,
        height: props.size,
        focusable: "false",
        ...(props.label === undefined
          ? { "aria-hidden": "true" }
          : { role: "img", "aria-label": props.label }),
        // Vertically centred on the text line; `shrink-0` so a flex row never squeezes it.
        class: "shrink-0 align-[-0.125em]",
      });
    };
  },
});
</script>
