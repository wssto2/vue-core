import { expect, test } from "@playwright/test";
import { MANAGER, mockAuth, serveRoles } from "./support";

test("a manager gives a person the manager role", async ({ page }) => {
  await mockAuth(page, ["iam.role:view", "iam.role:manage", "iam.user:view"]);
  const access = await serveRoles(page);

  await page.goto("/iam/users/3");
  await page.getByRole("button", { name: "Add role" }).click();
  await page.getByRole("option", { name: MANAGER.name }).click();
  await page.getByRole("button", { name: "Save" }).click();

  // The next read shows the change; the spec reads what the page sent through `calls`.
  expect(access.calls).toContainEqual({ method: "POST", path: "/iam/users/3/bindings", body: { role_ref: "manager", level: "dealer", scope_id: 1 } });
  expect(access.bindings["user:3"]).toHaveLength(2);
});
