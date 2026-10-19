# Recipe: roles and access with go-core's access module

go-core's `access` module is the administration of what `authz` decides: which roles exist, who holds them where, and who may give them. This library has the screens for it: the list of roles, the editor with the permission tree, compare and replace, a person's roles with *Add role*, and the panel that says what a person can do and why. They read the module's routes (`/v1/iam/roles`, `/v1/iam/users/:id/access`, ...; the server mounts them with `access.Install`) and need nothing of your application but its permission catalogue.

## Install it

<!-- example: docs/examples/access/main.ts -->
```ts
// The composition root of an application with roles: the access feature next to sign-in.
import { accessFeature } from "@wssto2/vue-core/access";
import { createApplication } from "@wssto2/vue-core/app";
import { identityFeature, identityPlatform } from "@wssto2/vue-core/identity";
import { createPlatform, readBootstrap } from "@wssto2/vue-core/platform";
import { backofficeShell } from "@wssto2/vue-core/shell";
import { permissions } from "./permissions";

const platform = createPlatform({ config: readBootstrap(), ...identityPlatform() });

const application = createApplication({
  platform,
  shell: backofficeShell(),
  features: [
    identityFeature({ home: "/tickets" }),
    accessFeature({
      // The roles editor is this catalogue: modules, screens, actions.
      catalogue: permissions,
      // A holder's name on a role's page leads to their record (null: not a link).
      subjectRoute: (subject) => (subject.kind === "user" ? { name: "users.record", params: { id: subject.id } } : null),
      // The backend's menu entry that opens the list of roles.
      destination: "iam.roles",
    }),
  ],
});

void application.mount("#app");
```

The feature installs `/iam/roles` (route `access.roles`), `/iam/roles/new` (`access.roles.new`, `?copy=<ref>` starts from another role) and `/iam/roles/:ref` (`access.role`). They are typed targets as `accessPages` (`accessPages.role({ ref: "seller" })`), for a link from your own pages. Every page and every action sits behind the module's fixed permissions, and the server decides again:

| Permission | Gates |
|---|---|
| `iam.role:view` | the list, a role's page, its holders, compare |
| `iam.role:manage` | new role, copy, edit, replace (create and update, never delete) |
| `iam.role:delete` | delete a role (its own permission) |
| `iam.user:view` | a person's roles and what they can do |
| `iam.user:manage` | add and remove a role for a person (also only when the server says `can_manage` for that person) |

`destination` is the token your backend's navigation uses for the roles menu entry; without it the feature adds no menu entry and you link to `accessPages.roles` yourself.

## The catalogue and its texts

The role editor is your permission catalogue: modules as tabs (a list on the left, a tab bar on phones), each screen a group of switches, with **requirements kept consistent** (switching a permission on switches on what it needs, off what needs it; a role saved before a permission gained a requirement is completed on load, with a note, and the additions count as unsaved changes). Where a record has an owner the group opens with *whose* (own, location's, all), held once per record type. Sensitive and system permissions carry a mark. Pass the object go-core's `authzts` generates, as it is:

<!-- example: docs/examples/access/permissions.ts -->
```ts
// What go-core's `authzts` writes from the application's catalogue (`frontend/generated/permissions.ts`), shortened to two entries.
// The texts are the application's: `labelKey` and `descriptionKey` are keys of its own messages.
import type { PermissionCatalogue } from "@wssto2/vue-core/access";

export const permissions: PermissionCatalogue = {
  "tickets.ticket:view": { module: "tickets", resource: "ticket", verb: "view", labelKey: "perm.tickets.ticket.view", descriptionKey: "", sensitive: false, system: false, organizationOnly: false, ownable: "tickets.ticket", unownedIsOwn: false, feature: null, attributes: [], requires: [] },
  "tickets.ticket:delete": { module: "tickets", resource: "ticket", verb: "delete", labelKey: "perm.tickets.ticket.delete", descriptionKey: "", sensitive: true, system: false, organizationOnly: false, ownable: "tickets.ticket", unownedIsOwn: false, feature: null, attributes: [], requires: ["tickets.ticket:view"] },
};
```

go-core never holds texts, so the library asks your messages (a name nobody wrote a text for is shown as it is):

| Key | Says |
|---|---|
| the catalogue's `labelKey` / `descriptionKey` | a permission's label and hint |
| `access.modules.<module>` | a module's tab (`system` permissions are one tab, `core.access.system_group`) |
| `access.resources.<module>_<resource>` | a screen's heading |
| `access.ownable.<record_type>` | "whose customers" (dots in the record type become underscores) |
| `access.roles.<key>` | the name of a predefined role in the person's language (custom roles show the name they were saved with) |
| `access.levels.<level>` | the name of a level of your hierarchy (`organization` is provided) |

## Constraints on a role

A role's `attrs` are go-core's constraints on it, your own business. Attributes the library has no field for are shown as marks and kept as they are on save. `roleConstraints` gives one a field: a choice among its `options`, or none. It is a row in the role editor's *Role* group and a read row on a predefined role's page.

<!-- example: docs/examples/access/roleOptions.ts -->
```ts
import { accessFeature } from "@wssto2/vue-core/access";
import { permissions } from "./permissions";

// A role may be for new vehicles only, used only, or both: stored in the role's `attrs` under the key the permissions declare
// (`authz.Attributes("vehiclekind")` on the server: one lowercase word). "All" leaves the key out.
export const access = accessFeature({
  catalogue: permissions,
  roleConstraints: [
    {
      attribute: "vehiclekind",
      labelKey: "roles.vehicle_kind",
      options: [
        { value: "new", labelKey: "roles.kind.new" },
        { value: "used", labelKey: "roles.kind.used" },
      ],
    },
  ],
  // The sentences for the codes of the server's own role check (`access.WithRoleCheck`), as keys of the application's messages.
  problems: { vehicle_kind_conflict: "roles.problems.vehicle_kind_conflict" },
});

// roles.problems.vehicle_kind_conflict: "{permission} cannot be given to a role for used vehicles."
```

- The `attribute` is a key your permissions declare (`authz.Attributes(...)`). go-core requires **a single lowercase word** (`vehiclekind`, not `vehicle_kind`) and refuses a catalogue that breaks it; a key no permission declares is refused on save as `unknown_attribute`.
- The choice "none" (`core.access.constraints.any`, "All" by default; `anyLabelKey` words it otherwise) **omits the key** from `attrs`, which go-core reads as "allows all". A chosen option is stored as one value.
- A stored value list the choice cannot show (several values, an unknown one) reads as none and is kept as it is until the person changes that choice.
- Wherever a role is shown with its constraints (a person's roles, `BindingRow`), a constraint is worded by the option's `labelKey` ("Used only"). An attribute with no `roleConstraints` entry, or a value with no option, stays as `attribute: value`.

## A service account's roles

`PersonAccess` and *Add role* take a `subject: { kind, id }`. For a `user` they use go-core's person routes (`/v1/iam/users/:id/…`); for a `service` they use the service accounts' (`/v1/iam/service-accounts/:id/…`, the same handlers and answers, which go-core mounts when identity has service accounts). Nothing is configured: the kind chooses the routes. Adding and removing roles is offered to whoever holds `iam.serviceaccount:manage` for a service account, `iam.user:manage` for a person. The service account screens put the panel on an account's *Access* tab: [service accounts](service-accounts.md).

## When the server refuses a role

A role the server refuses as invalid (`authz.invalid`) carries `params.problems`, objects `{code, permission?, detail?}`. The form's failure area says one sentence per problem, and so do the toasts of the access screens. The library has texts for go-core's own codes (`core.access.problems.<code>`, in every language). For a code of your own role check, `problems` maps the code to a key of your messages (also to reword a built-in one). A text may use `{permission}`, the permission's label, and `{detail}`, the server's detail. A code with no text gets a general sentence that names it (`core.access.problems.unknown`). `useDescribeRefusal()` gives the same sentence for your own error handling.

## Compare, and people out of reach

*Compare* sets a role against any other role the actor may view, standard ones and your own alike, from any role's page; *Replace* still takes a predefined role. A person outside the administrator's reach answers 404 like one that does not exist, and the person's access panel shows the not-found state, not an error.

## Where a role applies

A person's roles carry a place: a level of your hierarchy and, below the root, one of its places. The library knows no level names: *Add role* asks the server (`GET /v1/iam/users/:id/scopes`) which places this person may be given roles at and the actor may give, reads the hierarchy off them (each place says its parent level), and offers the level (narrowest first, the usual whole-parent level chosen) and the chain of places down to it, with only the places that can complete a choice. Then it asks which roles the actor may give *there* (`GET /v1/iam/bindable-roles`, delegation already applied). **An application with one level asks nothing:** no level, no place, the role is bound at the root (the `root_level` the server names).

Two things come from your application, as options of `accessFeature`:

- `subjectRoute(subject)`: where a holder's name leads, or `null` (a service account that has no page).
- `scopes(subject, signal)`: the places, when they come from somewhere other than the server's route.

## A person's roles

`PersonAccess` is the section for a person's record: their roles with where each applies, *Add role*, *Remove* (both only when the server says the actor may), and *What Ana can do*, the effective permissions by module and screen with the roles that give them, how wide (whose records, which places) and *Why* for each action. A permission granted but switched off for the tenant is marked. `personRolesSection` is the label, icon and permission for the record's `meta.section`:

<!-- example: docs/examples/access/PersonRoles.vue -->
```vue
<script setup lang="ts">
import { PersonAccess } from "@wssto2/vue-core/access";

// A section of the person's record: their roles, with where each applies, and what they can do.
defineProps<{ person: { id: number; name: string } }>();
</script>

<template>
  <PersonAccess :subject="{ kind: 'user', id: person.id }" :name="person.name" />
</template>
```

<!-- example: docs/examples/access/routes.ts -->
```ts
import { personRolesSection } from "@wssto2/vue-core/access";
import { defineRoutes } from "@wssto2/vue-core/router";

// The person's record lists "Roles" among its sections; `personRolesSection` is the label, the icon and the permission go-core guards the access with.
export const userRoutes = defineRoutes({
  record: {
    name: "users.record",
    path: "/users/:id",
    component: () => import("./PersonRoles.vue"),
    meta: { remountOnParam: "id" },
    children: [{ name: "users.record.roles", path: "roles", component: () => import("./PersonRoles.vue"), meta: personRolesSection }],
  },
});
```

`BindingRow` (a role and its place, read-only) is exported for a profile page that shows a person's own roles.

## Refusals

go-core's delegation rules refuse with a reason; the screens say it in words (en, hr, bs, sl, sr-Latn: `core.errors.authz.*`, an app overrides any with `errors.authz.*`) where the failure belongs: under the save, in the dialog, in a toast for a delete.

| Reason | Said |
|---|---|
| `authz.escalation` | That role has permissions you do not hold yourself, so you cannot give it. |
| `authz.self_assignment` | You cannot give a role to yourself. |
| `authz.last_admin` | You cannot remove your own last access to roles and users. |
| `authz.role_in_use` | The role is still given to people. Replace it first or take it from their access. |
| `authz.forbidden`, `authz.invalid` | not allowed in that place; the role or the place is not valid |

`useRefusalMessage()` is the same sentence for a form of your own (`useForm({ failureMessage })`).

`RestrictedPanel` (`@wssto2/vue-core/access`) is what a page the person may not open can show in its place: a lock, `core.no_access`'s sentence, an optional `contact` address to write to, and a Back button (one step in the application's history, else `home`, default `/`). `createApplication({ noAccess })` renders a component without props, so give the address through a function: `noAccess: () => h(RestrictedPanel, { contact: "access@example.com" })`.

## Try it

`playground/identity.html` runs these screens against go-core's own dev server (`go run github.com/wssto2/go-core/cmd/devserver`): sign in as `admin`, edit roles at `/iam/roles`, open People and give `user` a role; sign in as `user` (the home page has the button) and none of it is offered.
