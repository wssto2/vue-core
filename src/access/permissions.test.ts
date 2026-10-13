import { fireEvent, screen } from "@testing-library/vue";
import { afterEach, describe, expect, it } from "vitest";
import { accessPermissions } from "./context";
import { findTest, queryTest, startAccess, type Started } from "./testing";
import type { PermissionCatalogue, PermissionMeta } from "./catalogue";
import { catalogue as base } from "./testing";

let running: Started | null = null;
afterEach(() => {
  running?.dispose();
  running = null;
  document.body.innerHTML = "";
});

const entry = (id: string, requires: string[] = []): [string, PermissionMeta] => [id, { ...(base["crm.lead:view"] as PermissionMeta), resource: id.split(":")[0]?.split(".")[1] ?? "", verb: id.split(":")[1] ?? "", requires }];

describe("turn on all", () => {
  // The first permission needs the two after it: granting it completes the module halfway through the loop.
  const catalogue: PermissionCatalogue = Object.fromEntries([entry("crm.lead:manage", ["crm.lead:view", "crm.lead:export"]), entry("crm.lead:view"), entry("crm.lead:export")]);

  it("grants every permission of the module, and turning off revokes them all", { timeout: 30_000 }, async () => {
    running = await startAccess({}, [accessPermissions.viewRoles, accessPermissions.manageRoles], "/iam/roles/new", { catalogue });
    await findTest("permission-tree");
    const count = () => queryTest("tree-count-crm")?.textContent;
    expect(count()).toBe("0 / 3");
    await fireEvent.click(screen.getByRole("button", { name: "Turn on all" }));
    expect(count()).toBe("3 / 3");
    await fireEvent.click(screen.getByRole("button", { name: "Turn off all" }));
    expect(count()).toBe("0 / 3");
  });
});
