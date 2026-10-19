import { afterEach, describe, expect, it } from "vitest";
import { createApplication } from "./application";
import { currentApplication, currentHttp } from "./current";
import { fakeBackend, options } from "./testing";

const made: { dispose(): void }[] = [];
afterEach(() => made.splice(0).forEach((application) => application.dispose()));
const create = () => {
  const application = createApplication(options(fakeBackend().platform, []));
  made.push(application);
  return application;
};

describe("currentApplication", () => {
  it("throws, saying what to do, before an application exists", () => {
    expect(() => currentApplication()).toThrow(/createApplication/);
    expect(() => currentApplication()).toThrow(/createTestApplication/);
  });

  it("is the application createApplication made, with its platform", () => {
    const application = create();
    expect(currentApplication()).toBe(application);
    expect(currentApplication().platform.http).toBeDefined();
  });

  it("is the newest of several, and falls back to none once that one is disposed", () => {
    const first = create();
    const second = create();
    expect(currentApplication()).toBe(second);
    first.dispose(); // not the current one: the binding stays
    expect(currentApplication()).toBe(second);
    second.dispose();
    expect(() => currentApplication()).toThrow(/createApplication/);
  });
});

describe("currentHttp", () => {
  it("is the platform's client of the current application, read when it is called", () => {
    expect(() => currentHttp()).toThrow(/createApplication/);
    const application = create();
    expect(currentHttp()).toBe(application.platform.http);
  });
});
