import { accessFeature, accessPermissions } from "@wssto2/vue-core/access";
import { defineFeature } from "@wssto2/vue-core/app";
import { defineRoutes } from "@wssto2/vue-core/router";
import { permissions } from "./permissions";

// The dev server's two people; a real application reads them from its users list.
export const people = [
  { id: 1, name: "admin" },
  { id: 2, name: "user" },
] as const;

const routes = defineRoutes({
  people: { name: "people", path: "/people", component: () => import("./People.vue"), meta: { access: accessPermissions.viewAccess } },
  person: { name: "person", path: "/people/:id", component: () => import("./Person.vue"), meta: { access: accessPermissions.viewAccess, remountOnParam: "id" } },
});

export const personTarget = routes.person;

// What the dev server's administrator edits: roles (/iam/roles) and who holds them (a person's page). The person `user` sees none of it.
export const accessFeatures = [
  accessFeature({ catalogue: permissions, subjectRoute: (subject) => (subject.kind === "user" ? routes.person({ id: subject.id }) : null) }),
  defineFeature({ id: "people", routes: routes.records }),
];
