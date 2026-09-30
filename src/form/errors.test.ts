import { describe, expect, it } from "vitest";
import { ErrorBag } from "./errors";
import { fieldOfPath, issuesToMessages } from "./validation";

describe("ErrorBag", () => {
  it("adds, reads the first message, and clears one field or all", () => {
    const bag = new ErrorBag();
    bag.add("name", "Required");
    bag.add("name", "Too short");
    bag.add("age", "Too low");
    expect(bag.first("name")).toBe("Required");
    expect(bag.has("age")).toBe(true);
    expect(bag.count.value).toBe(2);
    bag.clear("name");
    expect(bag.has("name")).toBe(false);
    bag.clear();
    expect(bag.count.value).toBe(0);
  });

  it("answers for a value inside a list or object by the field's name, and clears it with the field", () => {
    const bag = new ErrorBag();
    bag.set({ "lines.0.quantity": ["Too low"], lines_total: ["x"] });
    expect(bag.has("lines")).toBe(true);
    expect(bag.first("lines")).toBeUndefined();
    expect(bag.first("lines.0.quantity")).toBe("Too low");
    bag.clear("lines");
    expect(bag.has("lines")).toBe(false);
    expect(bag.has("lines_total")).toBe(true);
  });

  it("does not alter the lists it was given (ARV's record() aliased the server's object, so a later add changed it)", () => {
    const fromServer = { name: ["Required"] };
    const bag = new ErrorBag();
    bag.set(fromServer);
    bag.add("name", "Another");
    expect(fromServer.name).toEqual(["Required"]);
  });

  it("ignores empty lists", () => {
    const bag = new ErrorBag();
    bag.set({ name: [] });
    expect(bag.count.value).toBe(0);
  });
});

describe("validation issues", () => {
  it("become messages per dotted path; the form as a whole is the empty path", () => {
    expect(
      issuesToMessages([
        { path: ["lines", 0, "quantity"], message: "a" },
        { path: ["lines", 0, "quantity"], message: "b" },
        { path: [], message: "whole" },
      ]),
    ).toEqual({ "lines.0.quantity": ["a", "b"], "": ["whole"] });
    expect(fieldOfPath("lines.0.quantity")).toBe("lines");
    expect(fieldOfPath("name")).toBe("name");
  });
});
