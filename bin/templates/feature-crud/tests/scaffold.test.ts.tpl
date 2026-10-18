import { describe, expect, it } from "vitest";
import { __FEATURE_API_CLIENT__, __FEATURE_LIST__ } from "..";

describe("__FEATURE_API_CLIENT__ scaffold", () => {
  it("defines the list over the generated route table", () => {
    const http = {} as Parameters<typeof __FEATURE_API_CLIENT__>[0];
    expect(__FEATURE_LIST__(__FEATURE_API_CLIENT__(http)).id).toBe("__FEATURE_I18N_MODULE__");
  });
});
