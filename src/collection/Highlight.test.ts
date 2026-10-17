import { render } from "@testing-library/vue";
import { describe, expect, it } from "vitest";
import Highlight from "./Highlight.vue";

describe("Highlight", () => {
  it("marks the words of the search, any case, and leaves the rest as text", () => {
    const { container } = render(Highlight, { props: { text: "Ana Horvat Hor", search: "ana  HOR" } });
    expect([...container.querySelectorAll("mark")].map((mark) => mark.textContent)).toEqual(["Ana", "Hor", "Hor"]);
    expect(container.textContent).toBe("Ana Horvat Hor");
  });

  it("renders no element of its own, and no mark without a search or a match", () => {
    const { container } = render(Highlight, { props: { text: "Ana", search: null } });
    expect(container.querySelector("mark")).toBeNull();
    expect(container.children).toHaveLength(0);
    const none = render(Highlight, { props: { text: "Ana", search: "zz" } });
    expect(none.container.querySelector("mark")).toBeNull();
  });
});
