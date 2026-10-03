# Recipe: users and "my profile"

go-core's identity module serves user administration (`/v1/iam/users…`) and every signed-in person's own profile (`/v1/iam/profile…`). `usersFeature()` is the screens for both, next to [`identityFeature()`](sign-in.md) (sign-in) in the same `@wssto2/vue-core/identity` entry.

<!-- example: docs/examples/identity/users.ts -->
```ts
// The composition root of an application that administers people: sign-in, then the users and profile screens.
import { createApplication } from "@wssto2/vue-core/app";
import { identityFeature, identityPlatform, usersFeature } from "@wssto2/vue-core/identity";
import { createPlatform, readBootstrap } from "@wssto2/vue-core/platform";
import { backofficeShell } from "@wssto2/vue-core/shell";

const platform = createPlatform({ config: readBootstrap(), ...identityPlatform() });

void createApplication({
  platform,
  shell: backofficeShell(),
  features: [
    identityFeature({ home: "/" }),
    // `destination` is the node of the server's menu that opens the list; every screen and action is behind the permission go-core checks.
    usersFeature({ destination: "users" }),
  ],
}).mount("#app");
```

Install it for everyone: the server's permission catalogue decides who sees what (`iam.user:view` reads, `iam.user:manage` writes, and the permission you gave go-core's `AllowImpersonation` shows "Sign in as"). A screen the person may not open is the no-access state; an action they may not do is not offered.

## The screens

**Users** (`/users`, route `users.index`). A list with the views Active, Locked, Inactive and All, search by name, username or e-mail, sorting by name, username, e-mail or creation, paging, and the state in the URL. **New user** (for `iam.user:manage`) asks for the username, name, e-mail, language and a password typed twice; the person's record opens after saving. Go-core's datatable does not count the views, so the tabs carry no numbers.

**A person** (`/users/:id`, `users.record`, sections as child routes). Opened from the list it steps through the same list (previous / next) and goes back to it.

| Section | What it does |
|---|---|
| Basic details | username, name, language, e-mail, phone, edited in place and saved from the toolbar with the whole record; the rows that deactivate or activate the person; when the account was made and last used |
| Sign-in | the lock (and **Unlock**), **Set a new password** (typed twice; it signs the person out everywhere and lifts the lock), **Sign in as** |
| Sessions | the devices, each with **Sign out**, and **Sign out everywhere**; a session somebody opened by signing in as the person is marked. On one's own record they are only listed: one's own devices are signed out in "my profile" |
| Sign-in history | every sign-in, successful or refused, with the device, the address and who did it when somebody else did |
| Changes | what was changed on the account and who did it, with what changed from what to what (never a password) |

**Deactivate** says what it does (signed out on every device, cannot sign in, roles and history stay) and asks once. When the application's deactivation hook refuses (`WithDeactivationHook` returns an error with a reason), the dialog stays open and says that reason: your text for it (`errors.<reason>` in the application's messages, with the error's params) or, without one, the sentence the server sent. Nobody can deactivate themselves (go-core refuses it, and the action is not offered).

**My profile** (`/profile`, route `profile`, no permission) and its entry in the account menu: name and phone; the e-mail address, changed in two steps (the new address and the current password, then the six-digit code mailed to the new address; **Resend** waits for the cooldown the server names, a change that waits for its code can be resumed or cancelled from the page, and an address taken in the meantime sends the person back to the address with the reason on the field); the password (current, new, repeated; every other session ends); the devices (this one marked, the others can be signed out); and the sign-in history.

Names of the people who did things (who signed in as the person, who changed their account) are not in go-core's rows, only ids: the screens ask for them one by one, and only for someone who may see people. Without a name a row says "Somebody else".

## Opting out, linking, adding

<!-- example: docs/examples/identity/usersOptions.ts -->
```ts
// What an application can leave out, link to, or add.
import type { PersonSection } from "@wssto2/vue-core/identity";
import { usersFeature, usersRoutes, profileRoutes } from "@wssto2/vue-core/identity";
import { h } from "vue";

// Only "my profile": no users list, no record.
export const profileOnly = usersFeature({ people: false });

// No "Sign in as" (the application did not turn impersonation on), and the profile reached from its own menu.
export const withoutSignInAs = usersFeature({ signInAs: false, profile: false });

// Links are typed targets: `to` of a RouterLink or `router.push`.
export const toTheList = usersRoutes.index;
export const toAPerson = (id: number) => usersRoutes.record({ id });
export const toMyProfile = profileRoutes.index;

// A section of the application's own on a person's record, after the feature's own (their roles, say).
const Roles = { props: ["name"], render() { return h("p", `Roles of ${(this as unknown as { name: string }).name}`); } };
const roles: PersonSection = {
  path: "roles",
  component: Roles,
  props: (person) => ({ name: person.name }),
  meta: { section: { labelKey: "people.roles", icon: "user3Line", groupKey: "core.users.section_groups.access" } },
};
export const withRoles = usersFeature({ sections: [roles] });
```

- The paths are fixed (`/users`, `/profile`) and so are the route names; link by `usersRoutes` and `profileRoutes`.
- `destination` binds the list to the node of the backend's menu that opens it; the record keeps it highlighted.
- `sections` adds a child route `users.record.<path>` after the feature's own. The component gets what `props` makes of the loaded person, so a feature of another module (the roles screens) is passed in by the application and identity never imports it. The section's label and icon texts are the application's keys.
- `signInAs: false` leaves out "Sign in as"; otherwise `identityFeature()` must be installed too (it is checked at start-up).

## Refusals

The texts are `core.errors.identity.*` in en, hr, bs and sl (an application overrides any with `errors.identity.…`): a field's reason (`identity.email.taken`, `identity.login.taken`, `identity.password.weak`…) lands under its field; a refusal of the whole action (a wrong code with its attempts left, a lock with the time of day, the deactivation hook's veto) is said above the form or under the code. Go-core's password rules are the server's: the screens say "does not meet the password rules" and do not mirror a checklist, since the application can set its own policy.

## Testing

The screens run in a real application in the library's own tests (a fake server answering by route, as in [testing](testing.md)); do the same for yours: install `identityFeature()` and `usersFeature()` and answer `GET /v1/auth/me` with the permissions you want to try.

## Developing against go-core

The dev server's two accounts show both sides: `admin` sees **Users** (and the record of `user`, whom it may also sign in as) and **My profile**; `user` sees only **My profile**. An e-mail change prints its code in the dev server's log. See `playground/identity.html`.
