import { afterEach, describe, expect, it } from "vitest";
import { createApplication, type ApplicationErrorReport } from "./application";
import { fakeBackend, options, page, settle, signedIn } from "./testing";
import { defineFeature } from "./feature";
import { useApplication } from "./environment";
import { defineComponent, h } from "vue";

const made: { dispose(): void }[] = [];
afterEach(() => made.splice(0).forEach((application) => application.dispose()));

function setup(location = "/") {
  const reports: ApplicationErrorReport[] = [];
  const home = defineFeature({ id: "home", routes: [{ name: "home", path: "/", component: page("home") }, { name: "login", path: "/login", component: page("login"), meta: { public: true } }] });
  const application = createApplication(options(fakeBackend().platform, [home], location, { onError: (report) => reports.push(report) }));
  made.push(application);
  return { application, reports };
}

describe("Application.report: a handled error", () => {
  it("goes through onError with source handled, the detail and the route", async () => {
    const { application, reports } = setup();
    await application.router.push("/");
    const error = new Error("save failed");
    application.report(error, { detail: "vehicle-location-edit" });
    expect(reports).toEqual([{ source: "handled", error, route: "/", detail: "vehicle-location-edit" }]);
  });

  it("needs no detail", () => {
    const { application, reports } = setup();
    application.report("odd");
    expect(reports).toMatchObject([{ source: "handled", error: "odd", detail: undefined }]);
  });

  it("is reachable in setup through useApplication()", async () => {
    const { reports } = setup();
    const reports2: ApplicationErrorReport[] = [];
    const application = createApplication(
      options(fakeBackend(signedIn(1)).platform, [defineFeature({ id: "x", routes: [{ name: "x", path: "/", component: defineComponent({ setup() { useApplication().report(new Error("from setup"), { detail: "d" }); return () => h("p"); } }) }, { name: "login", path: "/login", component: page("l"), meta: { public: true } }] })], "/", { onError: (r) => reports2.push(r) }),
    );
    made.push(application);
    const host = document.createElement("div");
    await application.mount(host);
    await settle();
    expect(reports2).toMatchObject([{ source: "handled", detail: "d" }]);
    expect(reports).toEqual([]);
  });
});
