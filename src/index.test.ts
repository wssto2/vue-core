import { describe, expect, it } from "vitest";
import pkg from "../package.json";
import { version } from "./index";

describe("version", () => {
  it("equals the version in package.json", () => {
    expect(version).toBe(pkg.version);
  });
});
